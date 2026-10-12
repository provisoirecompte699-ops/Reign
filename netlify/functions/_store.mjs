
import { getStore } from "@netlify/blobs";

const store = () => getStore("reign-price-tracker", { consistency: "strong" });
const empty = { products: {}, history: [] };

export async function readState() {
  const s = store();
  return (await s.get("state", { type: "json" })) || structuredClone(empty);
}

export async function writeState(state) {
  await store().setJSON("state", state);
}

export function parseAsin(value) {
  const s = String(value || "").trim();
  const m = s.match(/(?:\/dp\/|\/gp\/product\/|\/product\/)([A-Z0-9]{10})/i);
  const asin = (m ? m[1] : s).toUpperCase();

  if (!/^[A-Z0-9]{10}$/.test(asin)) {
    throw new Error("Entre un ASIN de 10 caractères ou un lien produit Amazon.fr.");
  }

  return asin;
}

export function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function parseKeepa(product) {
  const series = product?.csv?.[1] || [];
  const points = [];

  for (let i = 0; i + 1 < series.length; i += 2) {
    const t = series[i];
    const raw = series[i + 1];

    if (typeof raw === "number" && raw > 0) {
      points.push({
        price: raw / 100,
        date: new Date((t + 21564000) * 60000).toISOString()
      });
    }
  }

  const current = points.length ? points[points.length - 1].price : null;
  const lowestPoint = points.length
    ? points.reduce((a, b) => b.price < a.price ? b : a)
    : null;

  return {
    current,
    lowest: lowestPoint?.price ?? null,
    lowestDate: lowestPoint?.date ?? null,
    points
  };
}

export async function fetchKeepa(asin) {
  const key = process.env.KEEPA_API_KEY;

  if (!key) {
    throw new Error("KEEPA_API_KEY n’est pas configurée dans Netlify.");
  }

  const url = new URL("https://api.keepa.com/product");
  url.searchParams.set("key", key);
  url.searchParams.set("domain", process.env.KEEPA_DOMAIN || "4");
  url.searchParams.set("asin", asin);
  url.searchParams.set("history", "1");
  url.searchParams.set("stats", "365");

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });

  if (res.status === 429) {
    throw new Error("Limite API Keepa atteinte. Le suivi réessaiera au prochain cycle.");
  }

  if (!res.ok) {
    throw new Error(`Keepa a répondu HTTP ${res.status}.`);
  }

  const data = await res.json();

  if (!data.products?.length) {
    throw new Error("Produit introuvable dans l’historique Keepa Amazon France.");
  }

  return data.products[0];
}

export async function updateProduct(state, asin) {
  const p = await fetchKeepa(asin);
  const parsed = parseKeepa(p);
  const now = new Date().toISOString();
  const previous = state.products[asin] || {};

  const candidateLow = parsed.lowest;
  const lowest = previous.lowest_price == null
    ? candidateLow
    : candidateLow == null
      ? previous.lowest_price
      : Math.min(previous.lowest_price, candidateLow);

  const lowestDate =
    candidateLow != null &&
    (previous.lowest_price == null || candidateLow < previous.lowest_price)
      ? parsed.lowestDate
      : (previous.lowest_date || parsed.lowestDate);

  const item = {
    asin,
    title: p.title || previous.title || asin,
    image: p.imagesCSV
      ? `https://images-na.ssl-images-amazon.com/images/I/${p.imagesCSV.split(",")[0]}`
      : (previous.image || null),
    url: `https://www.amazon.fr/dp/${asin}`,
    current_price: parsed.current,
    lowest_price: lowest,
    lowest_date: lowestDate,
    last_checked: now,
    currency: "EUR",
    status: parsed.current == null ? "no_price" : "ok",
    samples: (previous.samples || 0) + (parsed.current == null ? 0 : 1)
  };

  state.products[asin] = item;

  if (parsed.current != null) {
    state.history.push({
      asin,
      price: parsed.current,
      checked_at: now,
      source: "Keepa / Amazon.fr"
    });
  }

  if (state.history.length > 20000) {
    state.history = state.history.slice(-20000);
  }

  return { ...item, points_imported: parsed.points.length };
}
