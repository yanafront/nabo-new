// Explicit, opt-in smoke test against the running Nuxt server and real Yandex data.
const base = process.env.NABO_URL || "http://localhost:3000";
const location = { lat: 53.9, lon: 27.5667 };
for (const storeId of ["sosedi", "evroopt", "green", "gippo", "belmarket", "santa"]) {
  const r = await fetch(`${base}/api/yandex/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ storeId, query: "молоко", location }),
  });
  const data = await r.json();
  if (!r.ok || data.status !== "ok" || !data.products.length)
    throw new Error(`${storeId}: ${data.error || r.status}`);
  console.log(
    `${storeId}: ${data.products.length} товаров, ${data.products[0].name}: ${data.products[0].price} BYN`,
  );
}
const response = await fetch(`${base}/api/yandex/compare`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    location,
    items: [
      { id: "milk", query: "молоко", quantity: 1 },
      { id: "bread", query: "хлеб", quantity: 1 },
    ],
  }),
});
const data = await response.json();
if (!response.ok || data.offers?.length !== 6)
  throw new Error("Comparison failed");
for (const offer of data.offers) {
  if (offer.lines.some((line) => line.error))
    throw new Error(`${offer.storeId}: upstream error`);
  console.log(
    offer.storeId,
    offer.lines.map((line) => ({
      query: line.query,
      selected: line.selected?.name,
      price: line.selected?.price,
    })),
  );
}
if (data.delivery !== null)
  throw new Error("Unknown delivery must not be free");
const invalid = await fetch(`${base}/api/yandex/search`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    storeId: "https://example.com",
    query: "milk",
    location,
  }),
});
if (invalid.status !== 400) throw new Error("Store allowlist failed");
console.log("Live smoke test passed");
