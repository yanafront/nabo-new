<script setup lang="ts">
import { recipeCategories, recipeCollections } from "~/shared/recipe/model";
import type { RecipeDocument } from "~/shared/recipe/editor";
import {
  recipeCollectionIds,
  recipeCollectionChanges,
  withRecipeCollections,
} from "~/shared/recipe/classification";
interface RecordRow {
  slug: string;
  revision: number;
  published: boolean;
  document: RecipeDocument;
}
interface Row {
  record: RecordRow;
  categoryId: string;
  collections: string[];
  error: string;
  conflict: boolean;
}
const rows = ref<Row[]>([]);
const categories = ref(recipeCategories);
const pending = ref(true),
  saving = ref(false),
  status = ref(0);
const filter = ref("");
const mode = ref<"categories" | "collections">("categories");
const toast = useToast();
const editorialCollections = recipeCollections.filter((c) =>
  ["family", "budget"].includes(c.id),
);
const columns = computed(() =>
  mode.value === "categories" ? categories.value : editorialCollections,
);
const visible = computed(() =>
  rows.value.filter((row) =>
    row.record.document.recipe.title
      .toLocaleLowerCase("ru")
      .includes(filter.value.trim().toLocaleLowerCase("ru")),
  ),
);
function changed(row: Row) {
  return (
    row.categoryId !== row.record.document.recipe.categoryId ||
    JSON.stringify(recipeCollectionIds(row.collections)) !==
      JSON.stringify(recipeCollectionIds(row.record.document.recipe.tags))
  );
}
const changes = computed(() => rows.value.filter(changed));
async function getRecords() {
  return await $fetch<{
    records: RecordRow[];
    categories?: typeof recipeCategories;
  }>("/api/admin/recipes", { retry: 0 });
}
async function load() {
  if (
    saving.value ||
    (changes.value.length &&
      !window.confirm("Обновить список и отменить несохранённые отметки?"))
  )
    return;
  pending.value = true;
  try {
    const result = await getRecords();
    categories.value = result.categories || recipeCategories;
    rows.value = result.records.map((record) => ({
      record,
      categoryId: record.document.recipe.categoryId,
      collections: recipeCollectionIds(record.document.recipe.tags),
      error: "",
      conflict: false,
    }));
    status.value = 200;
  } catch (e: any) {
    status.value = e.statusCode || e.status || 500;
    toast.show(
      status.value === 401
        ? "Войдите в служебный аккаунт."
        : status.value === 403
          ? "Нет доступа к редактору."
          : "Не удалось загрузить рецепты. Повторите попытку.",
      "error",
    );
  } finally {
    pending.value = false;
  }
}
function categoryChanged(row: Row, id: string, event: Event) {
  row.categoryId = (event.target as HTMLInputElement).checked ? id : "";
  row.error = "";
}
async function updateVersion(row: Row) {
  if (saving.value) return;
  const categoryWasChanged =
    row.categoryId !== row.record.document.recipe.categoryId;
  const intendedCollections = recipeCollectionChanges(
    row.record.document.recipe.tags,
    row.collections,
  );
  saving.value = true;
  try {
    const result = await getRecords();
    const record = result.records.find((r) => r.slug === row.record.slug);
    if (!record) throw new Error("deleted");
    row.record = record;
    if (!categoryWasChanged) row.categoryId = record.document.recipe.categoryId;
    row.collections = recipeCollectionIds(
      withRecipeCollections(record.document.recipe.tags, intendedCollections),
    );
    categories.value = result.categories || recipeCategories;
    row.error = "";
    row.conflict = false;
    toast.show(
      "Версия обновлена. Проверьте отметки и сохраните изменения.",
      "success",
    );
  } catch {
    toast.show("Не удалось обновить версию. Возможно, рецепт удалён.", "error");
  } finally {
    saving.value = false;
  }
}
async function save() {
  if (saving.value || !changes.value.length) return;
  if (
    changes.value.some(
      (row) => !categories.value.some((c) => c.id === row.categoryId),
    )
  ) {
    toast.show(
      "Выберите одну категорию блюда для каждого изменённого рецепта.",
      "error",
    );
    return;
  }
  if (
    changes.value.some(
      (row) =>
        withRecipeCollections(
          row.record.document.recipe.tags,
          recipeCollectionChanges(
            row.record.document.recipe.tags,
            row.collections,
          ),
        ).length > 30,
    )
  ) {
    toast.show(
      "В рецепте может быть не больше 30 тегов вместе с подборками.",
      "error",
    );
    return;
  }
  saving.value = true;
  let saved = 0;
  const targets = [...changes.value];
  try {
    for (const row of targets) {
      row.error = "";
      if (row.conflict) {
        row.error = "Сначала обновите версию";
        continue;
      }
      try {
        const collectionChanges = recipeCollectionChanges(
          row.record.document.recipe.tags,
          row.collections,
        );
        const categoryId =
          row.categoryId !== row.record.document.recipe.categoryId
            ? row.categoryId
            : undefined;
        const result = await $fetch<{ revision: number }>(
          `/api/admin/recipes/${row.record.slug}/classification`,
          {
            method: "PATCH",
            retry: 0,
            body: {
              categoryId,
              collections:
                collectionChanges.add.length || collectionChanges.remove.length
                  ? collectionChanges
                  : undefined,
              revision: row.record.revision,
            },
          },
        );
        row.record.revision = result.revision;
        row.record.document.recipe.categoryId = row.categoryId;
        row.record.document.recipe.tags = withRecipeCollections(
          row.record.document.recipe.tags,
          collectionChanges,
        );
        saved++;
      } catch (e: any) {
        const code = e.statusCode || e.status;
        row.conflict = code === 409;
        row.error = row.conflict
          ? "Рецепт изменён в другой вкладке"
          : code === 401
            ? "Сессия истекла"
            : code === 503
              ? "Бэкенд ещё не обновлён"
              : "Не сохранено. Попробуйте снова";
        if (code === 401 || code === 403 || code === 503) break;
      }
    }
    toast.show(
      saved === targets.length
        ? `Сохранено рецептов: ${saved}. Каталог обновится в течение минуты.`
        : `Сохранено: ${saved} из ${targets.length}. Остальные отметки сохранены в таблице — проверьте строки с ошибками.`,
      saved === targets.length ? "success" : "error",
    );
  } finally {
    saving.value = false;
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (changes.value.length || saving.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => {
  void load();
  window.addEventListener("beforeunload", beforeUnload);
});
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
onBeforeRouteLeave(
  () =>
    !saving.value &&
    (!changes.value.length ||
      window.confirm("Покинуть таблицу без сохранения отметок?")),
);
useHead({
  title: "Категории и подборки · Nabo",
  meta: [{ name: "robots", content: "noindex,nofollow" }],
});
</script>
<template>
  <div class="inner-page classification-admin">
    <NuxtLink to="/admin/recipes" class="back-link"
      ><AppIcon name="ArrowLeft" :size="16" /> Редактор рецептов</NuxtLink
    >
    <div class="page-heading">
      <div>
        <h1>Категории и подборки</h1>
        <p class="muted">
          Отмечайте блюда в таблице и сохраняйте изменения сразу для нескольких
          рецептов.
        </p>
      </div>
      <NuxtLink v-if="status === 200" to="/admin/categories" class="secondary"
        >Добавить или переименовать категорию</NuxtLink
      >
    </div>
    <p v-if="pending" role="status">
      <span class="spinner" /> Загружаем рецепты…
    </p>
    <NuxtLink
      v-else-if="status === 401"
      class="primary"
      :to="{
        path: '/account',
        query: { returnTo: '/admin/recipe-classification' },
      }"
      >Войти</NuxtLink
    >
    <button v-else-if="status !== 200" class="secondary" @click="load">
      Повторить загрузку
    </button>
    <template v-else>
      <div class="classification-toolbar">
        <label
          >Найти блюдо<input
            v-model="filter"
            type="search"
            placeholder="Название рецепта"
        /></label>
        <div class="classification-save">
          <span role="status">{{
            changes.length
              ? `Изменено рецептов: ${changes.length}`
              : `Всего рецептов: ${rows.length}`
          }}</span>
          <button
            class="primary"
            :disabled="saving || !changes.length"
            @click="save"
          >
            <span v-if="saving" class="spinner" />{{
              saving ? "Сохраняем…" : "Сохранить изменения"
            }}
          </button>
          <button class="text-button" :disabled="saving" @click="load">
            Обновить
          </button>
        </div>
      </div>
      <div
        class="classification-modes"
        role="tablist"
        aria-label="Что редактировать"
      >
        <button
          v-for="tab in [
            { id: 'categories', title: 'Категории блюд' },
            { id: 'collections', title: 'Подборки' },
          ]"
          :id="`tab-${tab.id}`"
          :key="tab.id"
          role="tab"
          :aria-selected="mode === tab.id"
          aria-controls="classification-table"
          :class="{ active: mode === tab.id }"
          @click="mode = tab.id as typeof mode"
        >
          {{ tab.title }}
        </button>
      </div>
      <p id="classification-help" class="muted">
        {{
          mode === "categories"
            ? "У блюда одна категория: новая отметка заменит прежнюю."
            : "Можно выбрать «Для семьи» и «Бюджетно». Подборки по времени, сложности и КБЖУ рассчитываются автоматически из данных рецепта."
        }}
        Названия блюд слева закреплены, столбцы можно прокручивать. Публикуются
        только эти отметки, а не незавершённая редакция рецепта.
      </p>
      <div
        id="classification-table"
        role="tabpanel"
        :aria-labelledby="`tab-${mode}`"
        class="classification-scroll"
        tabindex="0"
        aria-describedby="classification-help"
      >
        <table>
          <caption class="sr-only">
            Все рецепты:
            {{
              mode === "categories" ? "категории блюд" : "подборки"
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col" class="recipe-column">Блюдо</th>
              <th v-for="column in columns" :key="column.id" scope="col">
                {{ column.title }}
              </th>
              <th scope="col">Статус</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in visible"
              :key="row.record.slug"
              :class="{ changed: changed(row) }"
            >
              <th scope="row" class="recipe-column">
                <NuxtLink
                  :to="{
                    path: '/admin/recipes',
                    query: { recipe: row.record.slug },
                  }"
                  >{{ row.record.document.recipe.title }}</NuxtLink
                ><small>{{
                  row.record.published ? "Опубликован" : "Черновик"
                }}</small>
              </th>
              <td v-for="column in columns" :key="`${mode}:${column.id}`">
                <input
                  v-if="mode === 'categories'"
                  type="checkbox"
                  :checked="row.categoryId === column.id"
                  :disabled="saving"
                  :aria-label="`${row.record.document.recipe.title}: ${column.title}`"
                  @change="categoryChanged(row, column.id, $event)"
                />
                <input
                  v-else
                  v-model="row.collections"
                  type="checkbox"
                  :value="column.id"
                  :disabled="saving"
                  :aria-label="`${row.record.document.recipe.title}: ${column.title}`"
                  @change="row.error = ''"
                />
              </td>
              <td class="row-status">
                <span v-if="row.error" class="row-error">{{ row.error }}</span
                ><span v-else>{{
                  changed(row) ? "Не сохранено" : "Сохранено"
                }}</span
                ><button
                  v-if="row.conflict"
                  class="text-button"
                  :disabled="saving"
                  @click="updateVersion(row)"
                >
                  Обновить версию
                </button>
              </td>
            </tr>
            <tr v-if="!visible.length">
              <td :colspan="columns.length + 2">
                {{
                  rows.length
                    ? "По этому названию ничего не найдено"
                    : "Рецептов пока нет"
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
<style scoped>
.classification-admin .page-heading > div {
  min-width: 0;
  flex: 1;
}
.classification-admin .page-heading h1 {
  overflow-wrap: normal;
}
.classification-toolbar {
  display: flex;
  align-items: end;
  gap: 20px;
  justify-content: space-between;
  background: var(--surface, #fff);
  padding: 14px 0;
  position: sticky;
  top: var(--header-height, 96px);
  z-index: 5;
}
.classification-toolbar label {
  display: grid;
  gap: 6px;
  width: min(320px, 100%);
  font-size: 13px;
}
.classification-toolbar input {
  margin-top: 6px;
}
.classification-save {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.classification-save > span {
  color: var(--muted);
  font-size: 13px;
}
.classification-modes {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}
.classification-modes button {
  padding: 10px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: white;
}
.classification-modes button.active {
  border-color: var(--blue, #2f6bff);
  color: var(--blue, #2f6bff);
  background: var(--brand-soft);
}
.classification-admin > .muted {
  font-size: 13px;
  max-width: 900px;
  margin: 12px 0;
}
.classification-scroll {
  overflow: auto;
  max-height: 65dvh;
  border: 1px solid var(--line);
  border-radius: 16px;
  isolation: isolate;
}
.classification-scroll table {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  font-size: 13px;
}
.classification-scroll th,
.classification-scroll td {
  border-bottom: 1px solid var(--line);
  padding: 12px 16px;
  min-width: 100px;
  text-align: center;
  background: var(--surface, #fff);
}
.classification-scroll thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--bg);
  font-weight: 600;
}
.classification-scroll th.recipe-column {
  position: sticky;
  left: 0;
  text-align: left;
  min-width: 220px;
  max-width: 260px;
  z-index: 1;
  box-shadow: 1px 0 0 var(--line);
}
.classification-scroll thead th.recipe-column {
  z-index: 3;
  background: var(--bg);
}
.recipe-column a {
  color: var(--ink);
  display: block;
  overflow-wrap: anywhere;
  line-height: 1.4;
}
.recipe-column small {
  display: block;
  color: var(--muted);
  font-weight: 400;
  font-size: 11px;
  margin-top: 4px;
}
.classification-scroll .changed th,
.classification-scroll .changed td {
  background: var(--brand-soft);
}
.classification-scroll input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
  margin: 0;
  accent-color: var(--blue, #2f6bff);
}
.row-status {
  font-size: 12px;
  min-width: 150px !important;
}
.row-status button {
  display: block;
  margin: 6px auto 0;
  font-size: 12px;
}
.row-error {
  color: var(--blue, #2f6bff);
}
@media (max-width: 760px) {
  .classification-admin .page-heading {
    flex-direction: column;
    align-items: stretch;
  }
  .classification-admin .page-heading > .secondary {
    align-self: flex-start;
    white-space: normal;
  }
  .classification-admin .page-heading h1 {
    font-size: 30px;
    line-height: 1.15;
  }
  .classification-toolbar {
    top: 64px;
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
    padding: 10px 0;
  }
  .classification-toolbar label {
    width: 100%;
  }
  .classification-save {
    gap: 8px;
  }
  .classification-save .primary {
    margin-left: auto;
    padding: 10px 14px;
    font-size: 12px;
  }
  .classification-save > span {
    font-size: 11px;
  }
  .classification-save .text-button {
    font-size: 12px;
  }
  .classification-scroll {
    max-height: 58dvh;
  }
  .classification-scroll th.recipe-column {
    min-width: 145px;
    max-width: 145px;
  }
  .classification-scroll th,
  .classification-scroll td {
    padding: 12px 10px;
    min-width: 90px;
  }
}
</style>
