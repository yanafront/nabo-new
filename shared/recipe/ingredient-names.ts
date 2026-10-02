import { normalized } from "./model";
// Only split reviewed, unquantified combinations. Never duplicate a shared weight.
export const separateIngredients: Record<string, string[]> = {
  "сметана и варенье": ["Сметана", "Варенье"],
  "сметана и зелень": ["Сметана", "Зелень"],
  "соль и перец": ["Соль", "Перец черный"],
};
export function separateLegacyIngredientNames(names: string[]): string[] {
  return [
    ...new Set(
      names.flatMap((name) => separateIngredients[normalized(name)] || [name]),
    ),
  ];
}
