
import {
  readState,
  writeState,
  updateProduct
} from "./_store.mjs";

export default async () => {
  if (!process.env.KEEPA_API_KEY) {
    console.log("Relevé ignoré : KEEPA_API_KEY est absente.");
    return;
  }

  const state = await readState();
  const asins = Object.keys(state.products);
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
      await updateProduct(state, asin);
    } catch (error) {
      state.products[asin].status =
        "error: " + String(error.message).slice(0, 160);
      console.error("Échec du relevé", asin, error.message);
    }
  }

  state.pollCursor = asins.length
    ? (start + batch.length) % asins.length
    : 0;

  await writeState(state);
  console.log(`Reign : ${batch.length} produit(s) vérifié(s).`);
};
