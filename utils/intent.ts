export interface DishIntent {
  [key: string]: string | undefined;
  q?: string;
  collection?: "quick30" | "budget";
  servings?: string;
  budget?: string;
}

/** Turns natural meal intent into catalogue controls without inventing a recipe. */
export function parseDishIntent(value: string): DishIntent {
  const normalized = value.toLowerCase().replace(/ё/g, "е");
  const servings =
    normalized.match(/(?:на|для)\s+(\d+)/)?.[1] ||
    (/(^|\s)двоих(?=\s|$)/.test(normalized)
      ? "2"
      : /(^|\s)троих(?=\s|$)/.test(normalized)
        ? "3"
        : /(^|\s)четверых(?=\s|$)/.test(normalized)
          ? "4"
          : undefined);
  const budget = normalized
    .match(/(?:до|бюджет)\s*(\d+(?:[.,]\d+)?)/)?.[1]
    ?.replace(",", ".");
  const collection = /быстр|до\s*30\s*мин/.test(normalized)
    ? "quick30"
    : /бюджет|недорог|(?:^|\s)до\s*\d+(?:[.,]\d+)?\s*(?:byn|р|руб)/.test(
          normalized,
        )
      ? "budget"
      : undefined;
  const q = value
    .replace(
      /(?:на|для)\s+(?:\d+\s*(?:человек[а-яё]*|порци[а-яё]*)?|двоих|троих|четверых)/gi,
      " ",
    )
    .replace(/(?:до|бюджет)\s*\d+(?:[.,]\d+)?\s*(?:byn|р|руб(?:лей)?)?/gi, " ")
    .replace(/быстр[а-яё]*|бюджет[а-яё]*|недорог[а-яё]*|ужин[а-яё]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    ...(q ? { q } : {}),
    ...(collection ? { collection } : {}),
    ...(servings ? { servings } : {}),
    ...(budget ? { budget } : {}),
  };
}
