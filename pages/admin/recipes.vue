<script setup lang="ts">
import {
  ingredientAmount,
  perServing,
  recipeCategories,
  recipeCollections,
  type Recipe,
  type RecipeIngredient,
} from "~/shared/recipe/model";
import type { RecipeDocument } from "~/shared/recipe/editor";
import { retailStores, type SearchResult } from "~/shared/yandex";
interface RecordRow {
  slug: string;
  document: RecipeDocument;
  revision: number;
  published: boolean;
}
const photosConfigured = ref(false),
  uploading = ref(false);
const records = ref<RecordRow[]>([]);
const pending = ref(true),
  saving = ref(false),
  error = ref(""),
  message = ref("");
const authStatus = ref(0),
  filter = ref("");
const draft = ref<RecipeDocument>();
const revision = ref(0),
  dirty = ref(false),
  lockedSlug = ref("");
const { location } = useRetail();
const { searchAllProducts } = useApi();
const checking = ref(false),
  checkIndex = ref(-1),
  results = ref<SearchResult[]>([]);
let checkController: AbortController | undefined;
const previewNutrition = computed(
  () => draft.value && perServing(draft.value.recipe),
);
const list = computed(() =>
  records.value
    .map((record) => record.document.recipe)
    .filter((recipe) =>
      recipe.title.toLowerCase().includes(filter.value.toLowerCase()),
    ),
);

async function load() {
  pending.value = true;
  error.value = "";
  try {
    const data = await $fetch<{
      records: RecordRow[];
      photosConfigured: boolean;
    }>("/api/admin/recipes", { retry: 0 });
    photosConfigured.value = data.photosConfigured;
    records.value = data.records;
    authStatus.value = 200;
  } catch (e: any) {
    authStatus.value = e.statusCode || e.status;
    error.value =
      authStatus.value === 401
        ? "Войдите в служебный аккаунт."
        : authStatus.value === 403
          ? "У этого аккаунта нет доступа к редактору."
          : "API редактора пока недоступен. Требуется подключение обновлённого бэкенда.";
  } finally {
    pending.value = false;
  }
}
function canLeave() {
  return (
    !dirty.value ||
    window.confirm("Есть несохранённые изменения. Покинуть редактор?")
  );
}
function select(recipe?: Recipe) {
  if (saving.value || uploading.value || !canLeave()) return;
  checkController?.abort();
  checking.value = false;
  checkIndex.value = -1;
  results.value = [];
  const stored = recipe && records.value.find((r) => r.slug === recipe.slug);
  const document = stored?.document || {
    recipe: {
      id: "",
      slug: "",
      title: "",
      categoryId: "mains",
      tags: [],
      servings: 2,
      ingredients: [],
      instructions: [],
      source: "Nabo",
      sourceId: "",
      isActive: true,
      shopabilityScore: 100,
    },
    ingredients: [],
  };
  draft.value = JSON.parse(JSON.stringify(document));
  revision.value = stored?.revision || 0;
  lockedSlug.value = recipe?.slug || "";
  for (const row of draft.value!.recipe.ingredients)
    row.searchQuery ||=
      draft.value!.ingredients.find((i) => i.id === row.ingredientId)
        ?.searchTerms[0] || row.name;
  dirty.value = false;
  message.value = "";
  error.value = "";
}
function addIngredient() {
  const id = crypto.randomUUID();
  draft.value!.ingredients.push({
    id,
    name: "",
    searchTerms: [""],
    aliases: [],
    pantry: false,
    common: true,
  });
  draft.value!.recipe.ingredients.push({
    ingredientId: id,
    name: "",
    quantity: 1,
    unit: "piece",
    searchQuery: "",
  });
  dirty.value = true;
}
function removeIngredient(index: number) {
  draft.value!.recipe.ingredients.splice(index, 1);
  dirty.value = true;
  checkController?.abort();
  checking.value = false;
  checkIndex.value = -1;
  results.value = [];
}
async function check(row: RecipeIngredient, index: number) {
  checkController?.abort();
  const c = new AbortController();
  checkController = c;
  checkIndex.value = index;
  checking.value = true;
  results.value = [];
  error.value = "";
  try {
    const result = await searchAllProducts(
      { query: row.searchQuery!, location: location.value },
      c.signal,
    );
    if (checkController === c) results.value = result.stores;
  } catch {
    if (!c.signal.aborted)
      error.value = "Не удалось проверить поиск. Повторите.";
  } finally {
    if (checkController === c) checking.value = false;
  }
}
function validate() {
  const r = draft.value!.recipe;
  if (
    !r.title.trim() ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug) ||
    r.slug.length > 100
  )
    return "Укажите название и адрес: латинские буквы, цифры и дефисы.";
  if (!Number.isInteger(r.servings) || r.servings < 1 || r.servings > 30)
    return "Количество порций: от 1 до 30.";
  if (!r.ingredients.length || r.ingredients.length > 20)
    return "Добавьте от 1 до 20 ингредиентов.";
  if (
    r.ingredients.some(
      (i) =>
        !i.name.trim() ||
        !i.searchQuery?.trim() ||
        i.searchQuery.length > 160 ||
        !Number.isFinite(i.quantity) ||
        i.quantity < 0 ||
        (!i.unquantified && i.quantity === 0),
    )
  )
    return "Укажите названия, поисковые запросы и количество ингредиентов.";
  if (r.instructions?.some((step) => !step.text.trim()))
    return "Заполните текст шагов приготовления или удалите пустые шаги.";
  if (r.image && !/^https:\/\//.test(r.image))
    return "Ссылка на фото должна начинаться с https://.";
  return "";
}
async function save(publish: boolean) {
  error.value = validate();
  if (error.value) return;
  saving.value = true;
  message.value = "";
  try {
    const doc: RecipeDocument = JSON.parse(JSON.stringify(draft.value));
    doc.recipe.id ||= `nabo:${doc.recipe.slug}`;
    doc.recipe.sourceId ||= doc.recipe.slug;
    // Keep editor-specific queries on each recipe row, preserving shared dictionary semantics.
    doc.ingredients = doc.ingredients.filter((i) =>
      doc.recipe.ingredients.some((row) => row.ingredientId === i.id),
    );
    for (const i of doc.ingredients) {
      const row = doc.recipe.ingredients.find(
        (row) => row.ingredientId === i.id,
      )!;
      i.name ||= row.name;
      if (!i.searchTerms[0]) i.searchTerms = [row.searchQuery!];
    }
    const result = await $fetch<{ revision: number }>(
      `/api/admin/recipes/${doc.recipe.slug}`,
      {
        method: "PUT",
        body: { document: doc, revision: revision.value, publish },
        retry: 0,
      },
    );
    const previous = records.value.find((r) => r.slug === doc.recipe.slug);
    records.value = [
      ...records.value.filter((r) => r.slug !== doc.recipe.slug),
      {
        slug: doc.recipe.slug,
        document: doc,
        revision: result.revision,
        published: publish || !!previous?.published,
      },
    ];
    revision.value = result.revision;
    lockedSlug.value = doc.recipe.slug;
    draft.value = doc;
    dirty.value = false;
    message.value = publish
      ? doc.recipe.isActive
        ? "Рецепт опубликован."
        : "Рецепт снят с публикации."
      : "Черновик сохранён. Каталог не изменён.";
  } catch (e: any) {
    error.value =
      e.statusCode === 409
        ? "Рецепт изменён в другой вкладке. Скопируйте свои правки и обновите страницу."
        : e.statusCode === 401
          ? "Сессия истекла. Скопируйте правки и войдите снова."
          : "Не удалось сохранить рецепт. Проверьте поля и соединение.";
  } finally {
    saving.value = false;
  }
}
async function uploadPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !draft.value) return;
  if (file.size > 4 * 1024 * 1024) {
    error.value = "Фото должно быть не больше 4 МБ.";
    input.value = "";
    return;
  }
  uploading.value = true;
  error.value = "";
  try {
    const body = new FormData();
    body.append("photo", file);
    const result = await $fetch<{ url: string }>("/api/admin/recipe-photo", {
      method: "POST",
      body,
      retry: 0,
      timeout: 60000,
    });
    draft.value.recipe.image = result.url;
    dirty.value = true;
  } catch (e: any) {
    error.value =
      e.data?.message || "Не удалось загрузить фото. Попробуйте ещё раз.";
  } finally {
    uploading.value = false;
    input.value = "";
  }
}
function addNutrition() {
  draft.value!.recipe.nutrition = {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    basis: "serving",
    calculationType: "source",
    source: "Редакция Nabo",
  };
  dirty.value = true;
}
const units = {
  g: "г",
  kg: "кг",
  ml: "мл",
  l: "л",
  piece: "шт.",
  clove: "зубчик",
  tbsp: "ст. л.",
  tsp: "ч. л.",
  cup: "стакан",
  pinch: "щепотка",
  toTaste: "по вкусу",
  slice: "ломтик",
  sprig: "веточка",
  bunch: "пучок",
};
function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}
onMounted(() => {
  load();
  window.addEventListener("beforeunload", beforeUnload);
});
onBeforeUnmount(() => {
  checkController?.abort();
  window.removeEventListener("beforeunload", beforeUnload);
});
onBeforeRouteLeave(
  () => !dirty.value || window.confirm("Покинуть страницу без сохранения?"),
);
useHead({
  title: "Редактор рецептов · Nabo",
  meta: [{ name: "robots", content: "noindex,nofollow" }],
});
</script>
<template>
  <div class="inner-page recipe-admin">
    <div class="page-heading">
      <div>
        <h1>Редактор рецептов</h1>
        <p class="muted">Служебный раздел Nabo</p>
      </div>
      <button v-if="authStatus === 200" class="primary" @click="select()">
        Новый рецепт
      </button>
    </div>
    <p v-if="pending" role="status">Проверяем доступ…</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <NuxtLink
      v-if="authStatus === 401"
      :to="{ path: '/account', query: { returnTo: '/admin/recipes' } }"
      class="primary"
      >Войти</NuxtLink
    >
    <button
      v-else-if="authStatus !== 200 && !pending"
      class="secondary"
      @click="load"
    >
      Повторить
    </button>
    <p v-if="message" role="status">{{ message }}</p>
    <div v-if="authStatus === 200" class="admin-layout">
      <aside class="panel admin-list">
        <label
          >Найти рецепт<input
            v-model="filter"
            type="search"
            placeholder="Название" /></label
        ><button
          v-for="r in list"
          :key="r.slug"
          class="admin-list-item"
          :class="{ selected: draft?.recipe.slug === r.slug }"
          @click="select(r)"
        >
          <strong>{{ r.title }}</strong
          ><small>{{
            records.find((v) => v.slug === r.slug)
              ? "Есть редакция"
              : "Исходный каталог"
          }}</small>
        </button>
      </aside>
      <form
        v-if="draft"
        class="panel admin-form"
        @submit.prevent="save(false)"
        @input="dirty = true"
        @change="dirty = true"
      >
        <fieldset :disabled="saving || uploading">
          <h2>{{ draft.recipe.title || "Новый рецепт" }}</h2>
          <div class="admin-fields">
            <label
              >Название<input
                v-model="draft.recipe.title"
                maxlength="200"
                required /></label
            ><label
              >Адрес рецепта<input
                v-model="draft.recipe.slug"
                :readonly="!!lockedSlug"
                maxlength="100"
                placeholder="syrniki"
                required /></label
            ><label
              >Категория<select v-model="draft.recipe.categoryId">
                <option v-for="c in recipeCategories" :key="c.id" :value="c.id">
                  {{ c.title }}
                </option>
              </select></label
            ><label
              >Порции<input
                v-model.number="draft.recipe.servings"
                type="number"
                min="1"
                max="30"
                required /></label
            ><label
              >Время, минут<input
                v-model.number="draft.recipe.cookingTime"
                type="number"
                min="1" /></label
            ><label
              >Сложность<select v-model="draft.recipe.difficulty">
                <option value="easy">Просто</option>
                <option value="medium">Средне</option>
                <option value="hard">Сложно</option>
              </select></label
            >
          </div>
          <label
            >Описание<textarea
              v-model="draft.recipe.description"
              rows="2"
              maxlength="5000"
            />
          </label>
          <label
            >Фото: HTTPS-ссылка<input
              v-model="draft.recipe.image"
              type="url"
              placeholder="https://…" /></label
          ><label v-if="photosConfigured"
            >{{
              uploading
                ? "Загружаем фото…"
                : "Загрузить фото — JPEG, PNG или WebP, до 4 МБ"
            }}<input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="uploadPhoto"
          /></label>
          <p v-else class="muted">
            Хранилище ещё не подключено. Пока используйте HTTPS-ссылку на своё
            фото.
          </p>
          <img
            v-if="draft.recipe.image?.startsWith('https://')"
            :src="draft.recipe.image"
            class="admin-photo"
            alt="Фото рецепта"
            referrerpolicy="no-referrer"
          />
          <label
            >Автор / источник фото<input
              v-model="draft.recipe.imageAttribution"
              maxlength="500"
          /></label>
          <label
            >Источник рецепта<input
              v-model="draft.recipe.source"
              maxlength="200"
              required
          /></label>
          <label
            >Ссылка на источник — если есть<input
              v-model="draft.recipe.sourceUrl"
              type="url"
              placeholder="https://…"
          /></label>
          <label
            >Лицензия / условия использования<input
              v-model="draft.recipe.license"
              maxlength="200"
          /></label>
          <div class="admin-inline">
            <label v-for="collection in recipeCollections" :key="collection.id"
              ><input
                v-model="draft.recipe.tags"
                type="checkbox"
                :value="collection.id"
              />{{ collection.title }}</label
            >
          </div>
          <h2>Ингредиенты</h2>
          <p class="muted">
            Название увидит читатель. Поисковый запрос уйдёт в магазины:
            например, «Яйца куриные».
          </p>
          <div
            v-for="(row, index) in draft.recipe.ingredients"
            :key="index"
            class="admin-ingredient"
          >
            <div class="admin-fields">
              <label
                >Название в рецепте<input
                  v-model="row.name"
                  maxlength="200"
                  required /></label
              ><label
                >Поисковый запрос<input
                  v-model="row.searchQuery"
                  maxlength="160"
                  required /></label
              ><label
                >Количество<input
                  v-model.number="row.quantity"
                  @input="delete row.weightGrams"
                  type="number"
                  min="0"
                  step="any"
                  required /></label
              ><label
                >Единица<select
                  v-model="row.unit"
                  @change="delete row.weightGrams"
                >
                  <option
                    v-for="(label, value) in units"
                    :key="value"
                    :value="value"
                  >
                    {{ label }}
                  </option>
                </select></label
              >
            </div>
            <label
              >Точное название товара — необязательно<input
                v-model="row.exactName"
                maxlength="500"
                placeholder="Подсказка для подбора бэкендом"
            /></label>
            <label v-if="row.exactName"
              >Фасовка выбранного товара
              <input
                v-model="row.exactUnit"
                maxlength="80"
                placeholder="Например, 10 шт или 500 г"
              />
            </label>
            <div class="admin-inline">
              <label
                ><input v-model="row.optional" type="checkbox" />
                Необязательный</label
              ><label
                ><input v-model="row.unquantified" type="checkbox" /> По
                вкусу</label
              ><button
                type="button"
                class="text-button"
                :disabled="!row.searchQuery?.trim() || checking"
                @click="check(row, index)"
              >
                Проверить в магазинах</button
              ><button
                type="button"
                class="text-button"
                @click="removeIngredient(index)"
              >
                Удалить
              </button>
            </div>
            <div v-if="checkIndex === index" class="admin-search">
              <p v-if="checking">Ищем в магазинах…</p>
              <p v-else class="muted">
                Выдача поиска, не гарантия автоматического выбора. Точка:
                {{ location.label }}
              </p>
              <div v-for="store in results" :key="store.storeId">
                <strong>{{
                  retailStores.find((s) => s.id === store.storeId)?.name ||
                  store.storeId
                }}</strong>
                <p v-if="store.status !== 'ok'">Магазин не ответил</p>
                <p v-else-if="!store.products.length">Ничего не найдено</p>
                <button
                  v-for="product in store.products.slice(0, 5)"
                  :key="product.id"
                  type="button"
                  class="admin-search-item"
                  @click="
                    row.exactName = product.name;
                    row.exactUnit = product.unit;
                    dirty = true;
                  "
                >
                  {{ product.name }} · {{ product.price }} BYN
                  <small>Использовать название</small>
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            class="secondary"
            :disabled="draft.recipe.ingredients.length >= 20"
            @click="addIngredient"
          >
            Добавить ингредиент
          </button>
          <h2>Приготовление</h2>
          <label v-for="(step, index) in draft.recipe.instructions" :key="index"
            >Шаг {{ index + 1
            }}<textarea v-model="step.text" maxlength="5000" rows="2" /><button
              type="button"
              class="text-button"
              @click="
                draft.recipe.instructions!.splice(index, 1);
                dirty = true;
              "
            >
              Удалить шаг
            </button></label
          ><button
            type="button"
            class="secondary"
            @click="
              (draft.recipe.instructions ||= []).push({ text: '' });
              dirty = true;
            "
          >
            Добавить шаг
          </button>
          <h2>КБЖУ</h2>
          <button
            v-if="!draft.recipe.nutrition"
            type="button"
            class="text-button"
            @click="addNutrition"
          >
            Указать КБЖУ</button
          ><template v-else
            ><label
              >Расчёт<select v-model="draft.recipe.nutrition.basis">
                <option value="serving">На порцию</option>
                <option value="recipe">На весь рецепт</option>
                <option value="100g">На 100 г</option>
              </select></label
            >
            <div class="admin-fields">
              <label
                v-for="(label, key) in {
                  calories: 'Ккал',
                  protein: 'Белки, г',
                  fat: 'Жиры, г',
                  carbs: 'Углеводы, г',
                }"
                :key="key"
                >{{ label
                }}<input
                  v-model.number="draft.recipe.nutrition[key]"
                  type="number"
                  min="0"
                  step="any"
              /></label>
            </div>
            <label v-if="draft.recipe.nutrition.basis === '100g'"
              >Вес готового блюда, г<input
                v-model.number="draft.recipe.yieldGrams"
                type="number"
                min="1" /></label
            ><label
              >Источник КБЖУ<input
                v-model="draft.recipe.nutrition.source" /></label
            ><button
              type="button"
              class="text-button"
              @click="
                delete draft.recipe.nutrition;
                dirty = true;
              "
            >
              Убрать КБЖУ
            </button></template
          >
          <div class="admin-inline">
            <label
              ><input v-model="draft.recipe.isActive" type="checkbox" />
              Показывать в каталоге после публикации</label
            >
          </div>
          <details class="admin-preview">
            <summary>Предпросмотр рецепта</summary>
            <h2>{{ draft.recipe.title }}</h2>
            <p>{{ draft.recipe.description }}</p>
            <p>
              {{ draft.recipe.servings }} порций<span
                v-if="draft.recipe.cookingTime"
              >
                · {{ draft.recipe.cookingTime }} мин</span
              >
            </p>
            <p v-if="previewNutrition">
              На порцию: {{ Math.round(previewNutrition.calories) }} ккал · Б
              {{ Math.round(previewNutrition.protein) }} г · Ж
              {{ Math.round(previewNutrition.fat) }} г · У
              {{ Math.round(previewNutrition.carbs) }} г
            </p>
            <ul>
              <li v-for="(row, i) in draft.recipe.ingredients" :key="i">
                {{ row.name }} — {{ ingredientAmount(row) }}
              </li>
            </ul>
            <ol>
              <li v-for="(step, i) in draft.recipe.instructions" :key="i">
                {{ step.text }}
              </li>
            </ol>
          </details>
          <div class="admin-save">
            <button class="secondary" type="submit">
              {{ saving ? "Сохраняем…" : "Сохранить черновик" }}</button
            ><button class="primary" type="button" @click="save(true)">
              {{
                draft.recipe.isActive ? "Опубликовать" : "Снять с публикации"
              }}</button
            ><NuxtLink
              v-if="lockedSlug"
              :to="`/recipes/${lockedSlug}`"
              target="_blank"
              >Открыть в каталоге</NuxtLink
            >
          </div>
        </fieldset>
      </form>
      <div v-else class="panel admin-form">
        <h2>Выберите рецепт или создайте новый</h2>
        <p>
          Существующие рецепты сохраняют порции, КБЖУ и сценарий добавления в
          корзину.
        </p>
      </div>
    </div>
  </div>
</template>
<style scoped>
.admin-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.admin-list,
.admin-form {
  padding: 20px;
  min-width: 0;
}
.admin-list {
  max-height: 75vh;
  overflow: auto;
}
.admin-list-item {
  display: block;
  text-align: left;
  width: 100%;
  padding: 12px 6px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
}
.admin-list-item small {
  display: block;
  color: var(--muted);
  margin-top: 4px;
}
.admin-list-item.selected {
  color: var(--accent-blue);
}
.admin-form fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.admin-form h2 {
  margin: 22px 0 12px;
}
.admin-form label,
.admin-list label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  margin-bottom: 12px;
}
.admin-form input:not([type="checkbox"]),
.admin-form select,
.admin-form textarea,
.admin-list input {
  width: 100%;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: white;
  color: inherit;
  font: inherit;
}
.admin-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
}
.admin-ingredient {
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
  margin-bottom: 16px;
}
.admin-inline,
.admin-save {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.admin-inline label {
  flex-direction: row;
  align-items: center;
  margin: 0;
}
.admin-save {
  position: sticky;
  bottom: 0;
  background: white;
  border-top: 1px solid var(--line);
  padding: 16px 0;
  margin-top: 20px;
}
.admin-photo {
  width: 180px;
  height: 120px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 12px;
}
.admin-search {
  margin-top: 16px;
}
.admin-search-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  cursor: pointer;
}
.admin-search-item small {
  display: block;
  color: var(--accent-blue);
}
.admin-form .muted {
  font-size: 13px;
}
@media (max-width: 760px) {
  .admin-layout {
    grid-template-columns: 1fr;
  }
  .admin-list {
    max-height: 220px;
  }
  .admin-fields {
    grid-template-columns: 1fr;
  }
  .admin-form,
  .admin-list {
    padding: 14px;
  }
  .admin-save {
    bottom: 65px;
  }
}
</style>
