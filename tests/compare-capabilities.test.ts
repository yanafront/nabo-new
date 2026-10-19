import { describe, expect, it } from "vitest";
import { supportsStoreComparison } from "../shared/compare-capabilities";
const contract = (properties: object, reference = true) => ({
  paths: {
    "/api/yandex/compare": {
      post: {
        requestBody: {
          content: {
            "application/json": {
              schema: reference
                ? { $ref: "#/components/schemas/CompareRequest" }
                : { properties },
            },
          },
        },
      },
    },
  },
  components: { schemas: { CompareRequest: { properties } } },
});
describe("single-store comparison capability", () => {
  it("does not fan out against the legacy or missing contract", () => {
    expect(
      supportsStoreComparison(contract({ items: { type: "array" } })),
    ).toBe(false);
    expect(supportsStoreComparison(null)).toBe(false);
    expect(supportsStoreComparison({})).toBe(false);
  });
  it("supports both nullable ASP.NET and inline storeId schemas", () => {
    expect(
      supportsStoreComparison(
        contract({ storeId: { type: ["null", "string"] } }),
      ),
    ).toBe(true);
    expect(
      supportsStoreComparison(contract({ storeId: { type: "string" } }, false)),
    ).toBe(true);
  });
});
