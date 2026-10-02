import type { DeliveryLocation } from "./yandex";
export function validDeliveryPoint(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= 51 &&
    lat <= 57 &&
    lon >= 23 &&
    lon <= 33
  );
}
export interface AddressResult extends DeliveryLocation {
  precise: boolean;
}
export function photonAddresses(value: unknown): AddressResult[] {
  const data = value as {
    features?: Array<{
      geometry?: { coordinates?: unknown[] };
      properties?: Record<string, unknown>;
    }>;
  };
  if (!Array.isArray(data?.features)) return [];
  const results: AddressResult[] = [];
  for (const feature of data.features) {
    const p = feature.properties || {};
    const [lon, lat] = feature.geometry?.coordinates || [];
    if (p.countrycode !== "BY" || !validDeliveryPoint(lat, lon)) continue;
    const text = (key: string) =>
      typeof p[key] === "string" ? (p[key] as string) : "";
    const street = [text("street"), text("housenumber")]
      .filter(Boolean)
      .join(", ");
    const label = [
      ...new Set(
        [
          text("city") || text("town") || text("village"),
          street,
          text("name"),
        ].filter(Boolean),
      ),
    ]
      .join(", ")
      .slice(0, 160);
    if (
      !label ||
      results.some((r) => r.lat === lat && r.lon === lon && r.label === label)
    )
      continue;
    results.push({
      lat: lat as number,
      lon: lon as number,
      label,
      precise: !!text("housenumber"),
    });
  }
  return results.slice(0, 5);
}

export function yandexAddresses(value: unknown): AddressResult[] {
  const members = (value as any)?.response?.GeoObjectCollection?.featureMember;
  if (!Array.isArray(members)) return [];
  return members
    .flatMap((member: any) => {
      const obj = member?.GeoObject;
      const meta = obj?.metaDataProperty?.GeocoderMetaData;
      if (
        !obj ||
        typeof obj.Point?.pos !== "string" ||
        meta?.Address?.country_code !== "BY"
      )
        return [];
      const [lon, lat] = obj.Point.pos.split(/\s+/).map(Number);
      const label = meta.Address.formatted || meta.text;
      if (
        !validDeliveryPoint(lat, lon) ||
        typeof label !== "string" ||
        !label.trim()
      )
        return [];
      return [
        {
          lat,
          lon,
          label: label.slice(0, 160),
          precise: meta.kind === "house" && meta.precision === "exact",
        },
      ];
    })
    .slice(0, 5);
}
