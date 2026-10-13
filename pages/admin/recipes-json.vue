<script setup lang="ts">
import {
  parseRecipeJson,
  recipeJsonExample,
} from "~/shared/recipe/json-editor";
import type { RecipeDocument } from "~/shared/recipe/editor";
import { ingredientAmount, perServing } from "~/shared/recipe/model";
const { categories } = await useRecipeCategories();
const input = ref("");
const document = ref<RecipeDocument>();
const pending = ref(true),
  saving = ref(false),
  authStatus = ref(0),
  error = ref(""),
  message = ref("");
const created = ref("");
const existing = ref(new Set<string>());
const dirty = ref(false);
const nutrition = computed(
  () => document.value && perServing(document.value.recipe),
);
async function access() {
  pending.value = true;
  error.value = "";
  try {
    const data = await $fetch<{ records: { slug: string }[] }>(
      "/api/admin/recipes",
      { retry: 0 },
    );
    existing.value = new Set(data.records.map((row) => row.slug));
    authStatus.value = 200;
  } catch (e: any) {
    authStatus.value = e.statusCode || e.status;
    error.value =
      authStatus.value === 401
        ? "Войдите в служебный аккаунт."
        : authStatus.value === 403
          ? "У этого аккаунта нет доступа к редактору."
          : "Не удалось подключиться к редактору. Повторите попытку.";
  } finally {
    pending.value = false;
  }
}
function changed() {
  document.value = undefined;
  created.value = "";
  dirty.value = true;
  error.value = "";
}
function check() {
  error.value = "";
  document.value = undefined;
  try {
    const parsed = parseRecipeJson(input.value, categories.value);
    if (existing.value.has(parsed.recipe.slug))
      throw new Error(
        "Такой адрес рецепта уже есть. Измените slug — эта форма создаёт только новые рецепты.",
      );
    document.value = parsed;
    return true;
  } catch (e: any) {
    error.value = e.message;
    return false;
  }
}
function example() {
  if (dirty.value && !window.confirm("Заменить введённый JSON примером?"))
    return;
  input.value = JSON.stringify(recipeJsonExample, null, 2);
  changed();
  check();
}
async function upload(event: Event) {
  const control = event.target as HTMLInputElement;
  const file = control.files?.[0];
  if (!file) return;
  if (file.size > 250 * 1024) {
    error.value = "JSON-файл должен быть не больше 250 КБ.";
    control.value = "";
    return;
  }
  if (
    dirty.value &&
    !window.confirm("Заменить введённый JSON содержимым файла?")
  ) {
    control.value = "";
    return;
  }
  try {
    input.value = await file.text();
    changed();
    check();
  } catch {
    error.value = "Не удалось прочитать файл.";
  } finally {
    control.value = "";
  }
}
async function save(publish: boolean) {
  if (saving.value || created.value || !check()) return;
  saving.value = true;
  message.value = "";
  const doc = document.value!;
  try {
    await $fetch(`/api/admin/recipes/${doc.recipe.slug}`, {
      method: "PUT",
      body: { document: doc, revision: 0, publish },
      retry: 0,
    });
    created.value = doc.recipe.slug;
    existing.value.add(created.value);
    dirty.value = false;
    message.value =
      publish && doc.recipe.isActive
        ? "Рецепт создан и опубликован."
        : "Новый рецепт сохранён как черновик.";
  } catch (e: any) {
    error.value =
      e.statusCode === 409
        ? "Этот адрес рецепта уже занят. Измените slug. Существующий рецепт не изменён."
        : e.statusCode === 401
          ? "Сессия истекла. JSON остаётся в форме — скопируйте его и войдите снова."
          : e.statusCode === 400
            ? "Бэкенд отклонил документ. Проверьте JSON."
            : "Не удалось сохранить рецепт. JSON остаётся в форме, попробуйте снова.";
  } finally {
    saving.value = false;
  }
}
function newRecipe() {
  message.value = "";
  input.value = "";
  document.value = undefined;
  created.value = "";
  dirty.value = false;
  error.value = "";
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || saving.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => {
  void access();
  window.addEventListener("beforeunload", beforeUnload);
});
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
onBeforeRouteLeave(
  () =>
    !saving.value &&
    (!dirty.value || window.confirm("Покинуть страницу без сохранения JSON?")),
);
useHead({
  title: "Новый рецепт из JSON · Nabo",
  meta: [{ name: "robots", content: "noindex,nofollow" }],
});
</script>
<template>
  <div class="inner-page recipe-json-page">
    <NuxtLink class="back-link" to="/admin/recipes"
      ><AppIcon name="ArrowLeft" :size="16" /> К редактору рецептов</NuxtLink
    >
    <div class="page-heading">
      <div>
        <h1>Новый рецепт из JSON</h1>
        <p class="muted">
          Вставьте рецепт, проверьте его и сохраните. Существующие рецепты не
          перезаписываются.
        </p>
      </div>
    </div>
    <AppFeedback :message="error" />
    <AppFeedback :message="message" kind="success" />
    <p v-if="pending" role="status">
      <span class="spinner" /> Проверяем доступ…
    </p>
    <NuxtLink
      v-else-if="authStatus === 401"
      class="primary"
      to="/account?returnTo=/admin/recipes-json"
      >Войти</NuxtLink
    >
    <button v-else-if="authStatus !== 200" class="secondary" @click="access">
      Повторить
    </button>
    <div v-else class="json-layout">
      <form class="panel json-form" @submit.prevent="check">
        <fieldset :disabled="saving || !!created">
          <div class="json-toolbar">
            <h2>JSON рецепта</h2>
            <button type="button" class="text-button" @click="example">
              Вставить пример
            </button>
          </div>
          <label class="json-upload"
            >Загрузить .json<input
              type="file"
              accept=".json,application/json"
              @change="upload"
          /></label>
          <label for="recipe-json" class="sr-only">JSON нового рецепта</label>
          <textarea
            id="recipe-json"
            v-model="input"
            spellcheck="false"
            placeholder='{"slug": "syrniki", "title": "Сырники", ...}'
            @input="changed"
          />
          <button class="secondary" type="submit" :disabled="!input.trim()">
            Проверить и показать
          </button>
          <details class="json-help">
            <summary>Формат JSON</summary>
            <p>
              Обязательны <code>slug</code>, <code>title</code>,
              <code>categoryId</code>, <code>servings</code> и
              <code>ingredients</code>.
            </p>
            <p>
              У каждого ингредиента: <code>name</code>, <code>quantity</code>,
              <code>unit</code>, <code>searchQuery</code>. Поисковый запрос
              указывается отдельно, например «Яйца куриные».
            </p>
            <p>
              <code>exactName</code> и <code>exactUnit</code> уточняют название
              и фасовку. Единицы:
              <code
                >g, kg, ml, l, piece, clove, tbsp, tsp, cup, pinch, toTaste,
                slice, sprig, bunch</code
              >.
            </p>
            <p>
              Шаги <code>instructions</code> — строки или объекты
              <code>{"text": "…"}</code>. Фото <code>image</code> — ссылка
              https://. КБЖУ в <code>nutrition</code>:
              <code
                >calories, protein, fat, carbs, basis, calculationType,
                source</code
              >. Основа расчёта: <code>serving</code>, <code>recipe</code> или
              <code>100g</code>.
            </p>
            <p>
              Также принимается полный документ
              <code>{"recipe": {...}, "ingredients": [...]}</code>.
              Идентификаторы и словарь для короткого формата создаются
              автоматически.
            </p>
          </details>
        </fieldset>
      </form>
      <section class="panel json-preview">
        <template v-if="document">
          <h2>{{ document.recipe.title }}</h2>
          <img
            v-if="document.recipe.image"
            :src="document.recipe.image"
            alt=""
            class="json-photo"
          />
          <p class="muted">
            {{ document.recipe.servings }} порций<span
              v-if="document.recipe.cookingTime"
            >
              · {{ document.recipe.cookingTime }} мин</span
            >
            · {{ document.recipe.ingredients.length }} ингредиентов
          </p>
          <p v-if="document.recipe.description">
            {{ document.recipe.description }}
          </p>
          <p v-if="nutrition" class="muted">
            На порцию: {{ Math.round(nutrition.calories) }} ккал · Б
            {{ Math.round(nutrition.protein) }} г · Ж
            {{ Math.round(nutrition.fat) }} г · У
            {{ Math.round(nutrition.carbs) }} г
          </p>
          <ul class="json-ingredients">
            <li
              v-for="(row, index) in document.recipe.ingredients"
              :key="index"
            >
              <strong>{{ row.name }} · {{ ingredientAmount(row) }}</strong
              ><small
                >Поиск: {{ row.searchQuery
                }}<span v-if="row.exactName">
                  · Точное название: {{ row.exactName }}</span
                ><span v-if="row.exactUnit">
                  · Фасовка: {{ row.exactUnit }}</span
                ></small
              >
            </li>
          </ul>
          <ol v-if="document.recipe.instructions?.length">
            <li
              v-for="(step, index) in document.recipe.instructions"
              :key="index"
            >
              {{ step.text }}
            </li>
          </ol>
          <div v-if="created" class="json-actions">
            <NuxtLink
              class="primary"
              :to="{ path: '/admin/recipes', query: { recipe: created } }"
              >Открыть в редакторе</NuxtLink
            ><button class="secondary" @click="newRecipe">Создать ещё</button>
          </div>
          <div v-else class="json-actions">
            <button class="secondary" :disabled="saving" @click="save(false)">
              Сохранить черновик</button
            ><button
              class="primary"
              :disabled="saving || !document.recipe.isActive"
              @click="save(true)"
            >
              <span v-if="saving" class="spinner" />{{
                saving ? "Сохраняем…" : "Создать и опубликовать"
              }}
            </button>
          </div>
        </template>
        <template v-else
          ><h2>Предпросмотр</h2>
          <p class="muted">
            После проверки здесь появятся ингредиенты с поисковыми запросами и
            шаги приготовления.
          </p></template
        >
      </section>
    </div>
  </div>
</template>
<style scoped>
.json-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.json-form,
.json-preview {
  padding: 20px;
  min-width: 0;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.json-toolbar,
.json-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.json-toolbar {
  justify-content: space-between;
}
.json-toolbar h2 {
  margin: 0;
}
textarea {
  display: block;
  width: 100%;
  height: 430px;
  min-height: 220px;
  font-family: monospace;
  font-size: 13px;
  line-height: 1.55;
  margin: 16px 0;
  tab-size: 2;
}
.json-upload {
  display: block;
  margin-top: 16px;
  font-size: 13px;
  font-weight: 600;
}
.json-upload input {
  display: block;
  width: 100%;
  margin-top: 6px;
  font-size: 12px;
}
.json-help {
  margin-top: 16px;
  overflow-wrap: anywhere;
}
.json-help p {
  font-size: 12px;
}
.json-photo {
  display: block;
  width: 100%;
  height: 160px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 12px;
}
.json-preview {
  overflow-wrap: anywhere;
}
.json-ingredients {
  list-style: none;
  padding: 0;
}
.json-ingredients li {
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.json-ingredients strong,
.json-ingredients small {
  display: block;
}
.json-ingredients strong {
  font-size: 13px;
}
.json-ingredients small {
  margin-top: 4px;
}
.json-actions {
  margin-top: 20px;
}
@media (max-width: 760px) {
  .json-layout {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .json-form,
  .json-preview {
    padding: 16px;
  }
  textarea {
    height: 300px;
  }
  h1 {
    font-size: 26px;
  }
}
</style>
