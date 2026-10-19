export function supportsStoreComparison(doc: any): boolean {
  const schema =
    doc?.paths?.["/api/yandex/compare"]?.post?.requestBody?.content?.[
      "application/json"
    ]?.schema;
  const request = schema?.$ref
    ? doc.components?.schemas?.[schema.$ref.split("/").at(-1)]
    : schema;
  const type = request?.properties?.storeId?.type;
  return type === "string" || (Array.isArray(type) && type.includes("string"));
}
