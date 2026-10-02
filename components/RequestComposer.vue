<script setup lang="ts">
import { parseRequest } from "~/utils/basket";
import { parseDishIntent } from "~/utils/intent";
import type { Recipe as RecipeResult } from "~/shared/recipe/model";
const { resolve, resolveError } = useRecipeBasket();
const { items } = useBasket();
const { searchRecipes } = useApi();
const emit = defineEmits<{ openProduct: [query: string] }>();
const mode = ref<"dish" | "products">("dish");
const query = ref("");
const stage = ref("Ищем рецепт…");
const loading = ref(false);
const error = ref("");
const listening = ref(false);
let recognition: any;
let controller: AbortController | undefined;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let searchController: AbortController | undefined;
const recipeResults = ref<RecipeResult[]>([]);
const recipeSearchPending = ref(false);

function stopSuggestions() {
  clearTimeout(searchTimer);
  searchController?.abort();
  recipeSearchPending.value = false;
}
watch(query, (value) => {
  stopSuggestions();
  if (mode.value !== "dish" || value.trim().length < 2 || loading.value) {
    recipeResults.value = [];
    return;
  }
  const current = new AbortController();
  searchController = current;
  recipeSearchPending.value = true;
  searchTimer = setTimeout(async () => {
    try {
      const response = await searchRecipes(value, current.signal);
      if (!current.signal.aborted) recipeResults.value = response.recipes;
    } catch {
      if (!current.signal.aborted) recipeResults.value = [];
    } finally {
      if (searchController === current) recipeSearchPending.value = false;
    }
  }, 150);
});

async function chooseRecipe(recipe: RecipeResult) {
  stopSuggestions();
  const count = query.value.match(/(?:на|для)\s+(\d+)/)?.[1];
  await navigateTo({
    path: `/recipes/${recipe.slug}`,
    query: count ? { servings: count } : {},
  });
}
async function submit(value = query.value) {
  if (loading.value) return;
  query.value = value;
  if (!value.trim()) {
    error.value = "Напишите блюдо или продукты";
    return;
  }
  stopSuggestions();
  if (mode.value === "dish") {
    await navigateTo({
      path: "/recipes",
      query: parseDishIntent(value),
    });
    return;
  }
  const list = parseRequest(value);
  if (!list) {
    emit("openProduct", value.trim());
    return;
  }
  loading.value = true;
  stage.value = "Собираем вашу корзину…";
  error.value = "";
  controller = new AbortController();
  try {
    if (await resolve(list, controller.signal, items.value.length > 0))
      await navigateTo("/basket");
    else if (!controller.signal.aborted) error.value = resolveError.value;
  } finally {
    loading.value = false;
  }
}
function cancel() {
  controller?.abort();
  error.value = "";
}

function voice() {
  const Speech =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!Speech) {
    error.value =
      "В этом браузере голосовой ввод недоступен. Введите запрос текстом.";
    return;
  }
  if (listening.value) {
    recognition?.stop();
    return;
  }
  recognition = new Speech();
  recognition.lang = "ru-RU";
  recognition.onresult = (e: any) => (query.value = e.results[0][0].transcript);
  recognition.onerror = () => {
    error.value =
      "Не удалось услышать запрос. Проверьте доступ к микрофону или введите текст.";
    listening.value = false;
  };
  recognition.onend = () => (listening.value = false);
  try {
    recognition.start();
    listening.value = true;
  } catch {
    error.value = "Не удалось включить микрофон";
  }
}
onBeforeUnmount(() => {
  clearTimeout(searchTimer);
  searchController?.abort();
  controller?.abort();
  recognition?.abort();
});
function selectMode(next: "dish" | "products") {
  mode.value = next;
  query.value = "";
  error.value = "";
  recipeResults.value = [];
  nextTick(() =>
    document.querySelector<HTMLTextAreaElement>("#request")?.focus(),
  );
}
defineExpose({ submit, selectMode });
</script>
<template>
  <div class="composer-wrap">
    <div class="composer-modes" aria-label="Что вы хотите сделать?">
      <button
        type="button"
        :aria-pressed="mode === 'dish'"
        @click="selectMode('dish')"
      >
        Найти блюдо
      </button>
      <button
        type="button"
        :aria-pressed="mode === 'products'"
        @click="selectMode('products')"
      >
        Купить продукты
      </button>
    </div>
    <form class="composer" @submit.prevent="submit()">
      <label class="sr-only" for="request"
        >Что хотите купить или приготовить?</label
      ><textarea
        id="request"
        v-model="query"
        :disabled="loading"
        :placeholder="
          mode === 'dish'
            ? 'Например, борщ на 5 человек'
            : 'Например, молоко, яйца, хлеб'
        "
        rows="2"
        maxlength="250"
        @keydown.enter.exact.prevent="submit()"
      />
      <div class="composer-bottom">
        <div>
          <button
            type="button"
            class="icon-button"
            :class="{ listening }"
            :disabled="loading"
            :aria-label="listening ? 'Остановить запись' : 'Ввести голосом'"
            @click="voice"
          >
            <AppIcon name="Mic" /></button
          ><button
            class="send"
            :disabled="loading"
            :aria-label="mode === 'dish' ? 'Найти блюдо' : 'Добавить продукты'"
          >
            <span class="send-label">{{
              mode === "dish" ? "Найти блюдо" : "Добавить"
            }}</span
            ><span v-if="loading" class="spinner" /><AppIcon
              v-else
              name="ArrowUp"
              :size="24"
            />
          </button>
        </div>
      </div>
    </form>
    <div
      v-if="recipeResults.length && !loading"
      class="recipe-suggestions"
      role="listbox"
      aria-label="Найденные рецепты"
    >
      <button
        v-for="recipe in recipeResults"
        :key="recipe.slug"
        type="button"
        role="option"
        @click="chooseRecipe(recipe)"
      >
        <img v-if="recipe.image" :src="recipe.image" alt="" loading="lazy" />
        <span>
          <strong>{{ recipe.title }}</strong>
          <small
            >{{ recipe.cookingTime }} мин · {{ recipe.servings }} порций ·
            {{ recipe.ingredients.length }} продуктов</small
          >
        </span>
        <AppIcon name="ArrowRight" :size="16" />
      </button>
      <a
        href="https://github.com/farcrak/unitools-recipes"
        target="_blank"
        rel="noopener noreferrer"
      >
        Каталог Nabo · исходные данные UniTools
      </a>
    </div>
    <p
      v-if="recipeSearchPending && !loading"
      class="recipe-search-status"
      role="status"
    >
      Ищем рецепты…
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div v-if="loading" class="generation" role="status">
      <span class="spinner" /> {{ stage }}
      <button type="button" class="text-button" @click="cancel">
        Отменить
      </button>
    </div>
    <div v-else class="quick-queries">
      <button
        v-for="q in mode === 'dish'
          ? ['Борщ на 5 человек', 'Завтраки на двоих', 'Курица с рисом']
          : ['Молоко', 'Помидоры', 'Кофе молотый']"
        :key="q"
        @click="submit(q)"
      >
        {{ q }} <AppIcon name="Plus" :size="14" />
      </button>
    </div>
  </div>
</template>
