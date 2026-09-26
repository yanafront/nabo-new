<script setup lang="ts">
import { parseRequest } from "~/utils/basket";
import { recipeRequest, type RecipeResult } from "~/shared/recipes";
const { resolve, resolveError } = useRecipeBasket();
const { searchRecipes } = useApi();
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
  if (value.trim().length < 2 || loading.value) {
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
  if (loading.value) return;
  query.value = `${recipe.name} на ${recipe.servings} человек`;
  recipeResults.value = [];
  await submitRequest(recipeRequest(recipe));
}

async function submitRequest(result: ReturnType<typeof recipeRequest>) {
  stopSuggestions();
  stage.value = "Подбираем продукты в шести магазинах…";
  error.value = "";
  loading.value = true;
  controller = new AbortController();
  try {
    if (await resolve(result, controller.signal)) await navigateTo("/basket");
    else if (!controller.signal.aborted) error.value = resolveError.value;
  } finally {
    loading.value = false;
  }
}
async function submit(value = query.value) {
  if (loading.value) return;
  query.value = value;
  if (!value.trim()) {
    error.value = "Напишите блюдо или продукты";
    return;
  }
  stopSuggestions();
  loading.value = true;
  stage.value = "Ищем рецепт…";
  error.value = "";
  controller = new AbortController();
  const current = controller;
  try {
    let result = parseRequest(value);
    if (!result) {
      const response = await searchRecipes(value, current.signal);
      if (response.recipes[0]) result = recipeRequest(response.recipes[0]);
    }
    if (current.signal.aborted) return;
    if (!result) {
      error.value = "Рецепт не найден. Попробуйте другое название блюда.";
      return;
    }
    await submitRequest(result);
  } catch {
    if (!current.signal.aborted) error.value = "Не удалось найти рецепт. Повторите поиск.";
  } finally { loading.value = false; }
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
defineExpose({ submit });
</script>
<template>
  <div class="composer-wrap">
    <form class="composer" @submit.prevent="submit()">
      <label class="sr-only" for="request"
        >Что хотите приготовить или купить?</label
      ><textarea
        id="request"
        v-model="query"
        :disabled="loading"
        placeholder="Блюдо или список продуктов"
        rows="1"
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
            aria-label="Собрать корзину"
          >
            <span class="send-label">Найти продукты</span
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
          <strong>{{ recipe.name }}</strong>
          <small
            >{{ recipe.minutes }} мин · {{ recipe.servings }} порций ·
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
        501 рецепт · данные UniTools, CC BY-SA 4.0
      </a>
    </div>
    <p
      v-else-if="recipeSearchPending && !loading"
      class="recipe-search-status"
      role="status"
    >
      Ищем рецепты…
    </p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div v-if="loading" class="generation" role="status">
      <span class="spinner" /> {{ stage }}
      <button type="button" class="text-button" @click="cancel">Отменить</button>
    </div>
    <div v-else class="quick-queries">
      <button
        v-for="q in [
          'Борщ на 5 человек',
          'Завтраки на двоих',
          'Молоко, яйца, хлеб',
        ]"
        :key="q"
        @click="submit(q)"
      >
        {{ q }} <AppIcon name="Plus" :size="14" />
      </button>
    </div>
  </div>
</template>
