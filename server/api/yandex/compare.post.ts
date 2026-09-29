import { createError, defineEventHandler, readBody, sendWebResponse } from "h3";
import { backendResponse } from "../../utils/backend";
import {
  sizeOffers,
  type IngredientDemand,
} from "../../../shared/recipe/purchasing";
import type { CompareItem, StoreComparison } from "../../../shared/yandex";
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (
    !Array.isArray(body?.items) ||
    !body.items.some((i: CompareItem) => i?.requirement !== undefined)
  ) {
    return sendWebResponse(
      event,
      await backendResponse(event, "/api/yandex/compare", "POST", body),
    );
  }
  if (
    !body ||
    !Array.isArray(body.items) ||
    body.items.length < 1 ||
    body.items.length > 20
  )
    throw createError({ statusCode: 400, statusMessage: "Invalid basket" });
  const items: CompareItem[] = body.items;
  for (const item of items) {
    if (!item || typeof item.id !== "string")
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid basket item",
      });
    if (item.requirement) {
      const d: IngredientDemand = item.requirement;
      if (
        typeof d.query !== "string" ||
        !d.query.trim() ||
        d.query.length > 160 ||
        typeof d.ingredientId !== "string" ||
        d.ingredientId.length > 150 ||
        !Number.isFinite(d.amount) ||
        d.amount <= 0 ||
        d.amount > 100000 ||
        !["mass", "volume", "count"].includes(d.dimension)
      )
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid ingredient requirement",
        });
    }
  }
  // Reuse the deployed search + comparison service. Only the request/response unit conversion is local.
  const input = {
    ...body,
    items: items.map(({ requirement, ...i }) =>
      requirement ? { id: i.id, query: requirement.query, quantity: 1 } : i,
    ),
  };
  const response = await backendResponse(
    event,
    "/api/yandex/compare",
    "POST",
    input,
  );
  if (!response.ok) return sendWebResponse(event, response);
  const result = (await response.json()) as { offers: StoreComparison[] };
  return { ...result, offers: sizeOffers(result.offers, items) };
});
