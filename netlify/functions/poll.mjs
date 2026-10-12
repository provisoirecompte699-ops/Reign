
import {
  readState,
  writeState,
  updateProduct,
  json,
  errorResponse
} from "./_store.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return errorResponse("Utilise POST pour lancer un relevé.", 405);
  }

  if (!process.env.KEEPA_API_KEY) {
    return errorResponse(
      "Configure KEEPA_API_KEY dans les variables Netlify.",
      503
    );
  }

  const state = await readState();
  const asins = Object.keys(state.products);
  const results = [];

  const batchSize = 8;
  const start = asins.length
    ? ((state.pollCursor || 0) % asins.length)
    : 0;

  const batch = asins.length
    ? Array.from(
        { length: Math.min(batchSize, asins.length) },
        (_, i) => asins[(start + i) % asins.length]
      )
    : [];

  for (const asin of batch) {
    try {
      results.push({
        asin,
        ok: true,
        ...(await updateProduct(state, asin))
      });
    } catch (e) {
      state.products[asin].status =
        "error: " + String(e.message).slice(0, 160);

      results.push({
        asin,
        ok: false,
        error: e.message
      });
    }
  }

  state.pollCursor = asins.length
    ? (start + batch.length) % asins.length
    : 0;

  await writeState(state);

  return json({
    ok: true,
    checked_at: new Date().toISOString(),
    processed: results.length,
    total: asins.length,
    results
  });
};
