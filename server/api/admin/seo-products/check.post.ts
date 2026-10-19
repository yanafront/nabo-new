import { requireSeoEditor } from "../../../utils/seo-admin";
import { checkSeoConnection } from "../../../utils/seo-service";
export default defineEventHandler(async (event) => {
  await requireSeoEditor(event);
  const config = useRuntimeConfig(event);
  const result = {
    keyConfigured: !!config.seoIngestKey,
    connection: "missing_key",
    products: null as number | null,
  };
  try {
    result.products = (
      await $fetch<{ products: number }>(
        config.recipesApiBase.replace(/\/+$/, "") + "/api/seo/manifest",
        { timeout: 10000, retry: 0 },
      )
    ).products;
  } catch {
    result.connection = "unavailable";
  }
  if (!config.seoIngestKey) return result;
  try {
    const probe = await checkSeoConnection(event);
    result.connection = probe.saved === 0 ? "ready" : "unavailable";
  } catch (error: any) {
    result.connection = [401, 403].includes(
      error.statusCode || error.response?.status,
    )
      ? "rejected_key"
      : "unavailable";
  }
  return result;
});
