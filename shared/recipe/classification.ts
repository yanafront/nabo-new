import { recipeCollections } from "./model";
export function recipeCollectionIds(tags: readonly string[]) {
  return recipeCollections.filter((c) => tags.includes(c.id)).map((c) => c.id);
}
export function recipeCollectionChanges(
  before: readonly string[],
  after: readonly string[],
) {
  const previous = recipeCollectionIds(before),
    next = recipeCollectionIds(after);
  return {
    add: next.filter((id) => !previous.includes(id)),
    remove: previous.filter((id) => !next.includes(id)),
  };
}
/** Apply only explicitly toggled flags; preserve all other tags of this document. */
export function withRecipeCollections(
  tags: readonly string[],
  collections: { add: readonly string[]; remove: readonly string[] },
) {
  return [
    ...tags.filter(
      (tag) =>
        !collections.remove.includes(tag) && !collections.add.includes(tag),
    ),
    ...collections.add,
  ];
}
