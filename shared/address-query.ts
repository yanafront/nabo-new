// Reviewed Russian/Belarusian aliases used by OSM in Minsk. These only change
// a provider query; coordinates always come from the geocoder and user choice.
const aliases: Array<[RegExp, string]> = [
  [/(?<!\p{L})минск(?!\p{L})/giu, "Мінск"],
  [/(?<!\p{L})притыцкого(?!\p{L})/giu, "Прытыцкага"],
  [/(?<!\p{L})независимости(?!\p{L})/giu, "Незалежнасці"],
  [/(?<!\p{L})победителей(?!\p{L})/giu, "Пераможцаў"],
  [/(?<!\p{L})ленина(?!\p{L})/giu, "Леніна"],
  [/(?<!\p{L})немига(?!\p{L})/giu, "Няміга"],
  [/(?<!\p{L})сурганова(?!\p{L})/giu, "Сурганава"],
  [/(?<!\p{L})дзержинского(?!\p{L})/giu, "Дзяржынскага"],
  [/(?<!\p{L})авиационная(?!\p{L})/giu, "Авіяцыйная"],
  [/(?<!\p{L})(?:улица|ул\.)(?!\p{L})/giu, "вуліца"],
  [/(?<!\p{L})(?:проспект|пр-т)(?!\p{L})/giu, "праспект"],
];
export function photonQueryVariants(query: string): string[] {
  const original = query.trim().replace(/\s+/g, " ");
  const local = aliases.reduce(
    (text, [match, replacement]) => text.replace(match, replacement),
    original,
  );
  return [...new Set([local, original])];
}
