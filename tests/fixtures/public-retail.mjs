// SSR upstream fixture. Browser interactions still use each Playwright test's routes.
import { createServer } from "node:http";
createServer(async (req, res) => {
  let text = "";
  for await (const part of req) text += part;
  const body = text ? JSON.parse(text) : {};
  res.setHeader("content-type", "application/json");
  if (req.url === "/health") res.end("{}");
  else if (
    req.url === "/api/product" &&
    body.id === "milk" &&
    body.storeId === "evroopt"
  ) {
    res.end(
      JSON.stringify({
        status: "ok",
        product: {
          storeId: "evroopt",
          id: "milk",
          placeSlug: "evroopt",
          name: "Молоко питьевое стерилизованное натуральное цельное с витаминами для всей семьи, 1 л",
          price: 3.89,
          oldPrice: 4.19,
          unit: "1 л",
          available: true,
          stock: null,
          image: null,
          fetchedAt: "2026-10-01T00:00:00Z",
          description: "Состав: молоко. Хранить согласно условиям на упаковке.",
        },
      }),
    );
  } else if (req.url === "/api/product")
    res.end(JSON.stringify({ status: "not_found" }));
  else {
    res.statusCode = 404;
    res.end("{}");
  }
}).listen(3102, "127.0.0.1");
