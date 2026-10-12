
import {
  readState,
  writeState,
  parseAsin,
  updateProduct,
  json,
  errorResponse
} from "./_store.mjs";

export default async (request) => {
  const url = new URL(request.url);
  const asinFromPath = url.searchParams.get("asin");

  try {
    const state = await readState();

    if (request.method === "GET") {
      const items = Object.values(state.products)
        .sort((a, b) => a.title.localeCompare(b.title, "fr"));

      return json(items.map(p => ({
        ...p,
        lowest_date: p.lowest_date || null,
        history: state.history
          .filter(h => h.asin === p.asin)
          .slice(-30)
          .reverse()
      })));
    }

    if (request.method === "POST" && !asinFromPath) {
      const body = await request.json();
      let asin;

      try {
        asin = parseAsin(body.asin_or_url);
      } catch (e) {
        return errorResponse(e.message, 400);
      }

      if (state.products[asin]) {
        return errorResponse("Ce produit est déjà suivi.", 409);
      }

      state.products[asin] = {
        asin,
        title: asin,
        url: `https://www.amazon.fr/dp/${asin}`,
        current_price: null,
        lowest_price: null,
        lowest_date: null,
        last_checked: null,
        currency: "EUR",
        status: "pending",
        samples: 0
      };

      await writeState(state);

      if (!process.env.KEEPA_API_KEY) {
        return json({
          ok: true,
          asin,
          message: "Produit ajouté en attente. Configure KEEPA_API_KEY dans Netlify pour récupérer les prix réels."
        }, 202);
      }

      try {
        const result = await updateProduct(state, asin);
        await writeState(state);
        return json({ ok: true, ...result });
      } catch (e) {
        state.products[asin].status =
          "error: " + String(e.message).slice(0, 160);
        await writeState(state);
        return errorResponse(e.message, 502);
      }
    }

    if (request.method === "DELETE" && asinFromPath) {
      const asin = asinFromPath.toUpperCase();
      delete state.products[asin];
      state.history = state.history.filter(h => h.asin !== asin);
      await writeState(state);
      return json({ ok: true });
    }

    return errorResponse("Méthode non autorisée.", 405);
  } catch (e) {
    return errorResponse(e.message || "Erreur serveur", 500);
  }
};
