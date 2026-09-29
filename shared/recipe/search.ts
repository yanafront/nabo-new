import {
  normalized,
  perServing,
  recipeCategories,
  type Recipe,
  type Ingredient,
} from "./model";
const stop = new Set([
  "с",
  "со",
  "и",
  "из",
  "на",
  "до",
  "для",
  "по",
  "в",
  "к",
  "что",
  "хочу",
  "приготовить",
  "рецепт",
  "человек",
  "человека",
  "порции",
  "порций",
  "двоих",
  "ужин",
  "byn",
  "руб",
]);
// Small deterministic Russian morphology layer, shared by aliases and query terms.
export function stems(text: string) {
  return normalized(text)
    .split(" ")
    .filter((w) => w.length > 1 && !stop.has(w) && !/^\d+$/.test(w))
    .map((w) => {
      if (/^(макарон|спагет|фетуч|паст)/.test(w)) return "паста";
      if (/^(куриц|курин|куроч)/.test(w)) return "курица";
      if (/^(томат|помидор)/.test(w)) return "томат";
      return w.replace(
        /(иями|ами|ого|ему|ыми|ими|ая|яя|ое|ее|ые|ие|ой|ый|ий|ую|юю|ов|ев|ом|ем|ах|ях|ам|ям|ы|и|а|я|у|ю|е|о)$/,
        "",
      );
    });
}
export interface CatalogQuery {
  q?: string;
  category?: string;
  collection?: string;
  offset?: number;
  limit?: number;
}
const semanticCategoryTerms: Record<string, RegExp> = {
  chicken: /(^| )(куриц[а-я]*|курин[а-я]*|цыплен[а-я]*|индейк[а-я]*)($| )/,
  meat: /(^| )(говяд[а-я]*|свинин[а-я]*|баранин[а-я]*|телят[а-я]*|бекон[а-я]*|ветчин[а-я]*|колбас[а-я]*|мясн[а-я]*|фарш[а-я]*)($| )/,
  fish: /(^| )(рыб[а-я]*|лосос[а-я]*|семг[а-я]*|треск[а-я]*|тунец|тунц[а-я]*|форел[а-я]*|селед[а-я]*|сельдь|сельди|сельдью|скумбр[а-я]*|сардин[а-я]*|анчоус[а-я]*|кревет[а-я]*|мидии|мидий|кальмар[а-я]*|морепродукт[а-я]*)($| )/,
};
export function listRecipes(
  recipes: Recipe[],
  ingredients: Ingredient[],
  input: CatalogQuery,
) {
  const dictionary = new Map(ingredients.map((i) => [i.id, i]));
  const words = stems((input.q || "").slice(0, 120));
  const matchesCategory = (recipe: Recipe) => {
    if (!input.category) return true;
    if (
      recipe.categoryId === input.category ||
      recipe.tags.includes(input.category)
    )
      return true;
    const semantic = semanticCategoryTerms[input.category];
    if (!semantic) return false;
    const phrases = [
      recipe.title,
      ...recipe.ingredients.flatMap((item) => [
        item.name,
        dictionary.get(item.ingredientId)?.name,
      ]),
    ]
      .filter(Boolean)
      .map((value) => normalized(value!));
    return phrases.some(
      (phrase) =>
        semantic.test(phrase) &&
        !(input.category === "fish" && /(соус|бульон|паст)/.test(phrase)),
    );
  };
  const ranked = recipes
    .filter((r) => r.isActive)
    .filter(matchesCategory)
    .filter((r) => {
      const n = perServing(r);
      switch (input.collection) {
        case "quick20":
          return r.cookingTime !== undefined && r.cookingTime <= 20;
        case "quick30":
          return r.cookingTime !== undefined && r.cookingTime <= 30;
        case "protein":
          return !!n && n.protein >= 25;
        case "light":
          return !!n && n.calories <= 500;
        case "budget":
          return r.tags.includes("budget");
        case "family":
          return r.servings >= 4;
        case "easy":
          return r.difficulty === "easy" || r.tags.includes("easy");
        default:
          return true;
      }
    })
    .map((r) => {
      const title = stems(r.title);
      const text = new Set(
        stems(
          [
            r.title,
            r.description,
            recipeCategories.find((c) => c.id === r.categoryId)?.title,
            ...r.tags,
            ...r.ingredients.flatMap((i) => [
              i.name,
              ...(dictionary.get(i.ingredientId)?.aliases || []),
            ]),
          ].join(" "),
        ),
      );
      return {
        r,
        match: words.every((w) =>
          [...text].some((t) => t === w || (w.length >= 4 && t.startsWith(w))),
        ),
        score: words.filter((w) => title.includes(w)).length,
      };
    })
    .filter((x) => x.match)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.r.shopabilityScore - a.r.shopabilityScore ||
        (a.r.cookingTime || 999) - (b.r.cookingTime || 999) ||
        a.r.title.localeCompare(b.r.title, "ru"),
    );
  const offset = Math.max(0, Math.trunc(input.offset || 0)),
    limit = Math.min(48, Math.max(1, Math.trunc(input.limit || 24)));
  return {
    recipes: ranked.slice(offset, offset + limit).map((x) => x.r),
    total: ranked.length,
    offset,
    limit,
  };
}
