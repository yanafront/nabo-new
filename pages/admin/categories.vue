<script setup lang="ts">
interface Category {
  id: string;
  title: string;
  revision: number;
}
const categories = ref<Category[]>([]),
  pending = ref(true),
  saving = ref(false),
  status = ref(0);
const selected = ref<Category>(),
  title = ref(""),
  id = ref(""),
  deleting = ref<Category>();
const toast = useToast();
async function load() {
  pending.value = true;
  try {
    const result = await $fetch<{ categories: Category[] }>(
      "/api/admin/recipe-categories",
      { retry: 0 },
    );
    categories.value = result.categories;
    status.value = 200;
  } catch (e: any) {
    status.value = e.statusCode || e.status;
    toast.show(
      status.value === 401
        ? "Войдите в служебный аккаунт."
        : status.value === 403
          ? "Нет доступа к управлению категориями."
          : "Не удалось загрузить категории.",
      "error",
    );
  } finally {
    pending.value = false;
  }
}
function edit(category?: Category) {
  selected.value = category;
  title.value = category?.title || "";
  id.value = category?.id || "";
}
async function save() {
  if (saving.value) return;
  saving.value = true;
  try {
    await $fetch(
      `/api/admin/recipe-categories/${encodeURIComponent(id.value)}`,
      {
        method: "PUT",
        body: {
          title: title.value.trim(),
          revision: selected.value?.revision || 0,
        },
        retry: 0,
      },
    );
    await load();
    await refreshNuxtData("recipe-taxonomy");
    edit();
    toast.show(
      "Категория сохранена. Каталог обновится в течение минуты.",
      "success",
    );
  } catch (e: any) {
    toast.show(
      e.data?.message ||
        e.data?.data?.message ||
        "Не удалось сохранить категорию. Проверьте название, адрес и обновите список.",
      "error",
    );
  } finally {
    saving.value = false;
  }
}
async function remove() {
  const target = deleting.value;
  if (!target || saving.value) return;
  saving.value = true;
  try {
    await $fetch(`/api/admin/recipe-categories/${target.id}`, {
      method: "DELETE",
      query: { revision: target.revision },
      retry: 0,
    });
    deleting.value = undefined;
    if (selected.value?.id === target.id) edit();
    await load();
    await refreshNuxtData("recipe-taxonomy");
    toast.show("Категория удалена.", "success");
  } catch (e: any) {
    toast.show(
      e.data?.message ||
        e.data?.data?.message ||
        "Категория используется в рецептах или была изменена. Перенесите рецепты в другую категорию и обновите список.",
      "error",
    );
  } finally {
    saving.value = false;
  }
}
onMounted(load);
useHead({
  title: "Категории рецептов · Nabo",
  meta: [{ name: "robots", content: "noindex,nofollow" }],
});
</script>
<template>
  <div class="inner-page category-admin">
    <NuxtLink class="back-link" to="/admin/recipes"
      ><AppIcon name="ArrowLeft" :size="16" />Редактор рецептов</NuxtLink
    >
    <div class="page-heading">
      <h1>Категории рецептов</h1>
      <NuxtLink to="/admin/recipe-classification" class="secondary"
        >Распределить рецепты</NuxtLink
      >
      <button class="secondary" :disabled="pending || saving" @click="load">
        Обновить список
      </button>
    </div>
    <p v-if="pending" role="status">
      <span class="spinner" /> Загружаем категории…
    </p>
    <NuxtLink v-else-if="status === 401" class="primary" to="/account"
      >Войти</NuxtLink
    >
    <div v-else-if="status === 200" class="category-layout">
      <section aria-label="Список категорий">
        <div
          v-for="category in categories"
          :key="category.id"
          class="category-row"
        >
          <button
            class="category-name"
            :disabled="saving"
            @click="edit(category)"
          >
            <strong>{{ category.title }}</strong
            ><small>{{ category.id }}</small>
          </button>
          <button
            class="text-button"
            :disabled="saving"
            :aria-label="`Изменить категорию «${category.title}»`"
            @click="edit(category)"
          >
            Изменить
          </button>
          <button
            class="icon-button category-delete"
            :disabled="saving"
            :aria-label="`Удалить категорию «${category.title}»`"
            @click="deleting = category"
          >
            <AppIcon name="Trash2" :size="18" />
          </button>
        </div>
      </section>
      <form class="panel category-form" @submit.prevent="save">
        <h2>{{ selected ? "Редактирование категории" : "Новая категория" }}</h2>
        <label
          >Название категории<input
            v-model="title"
            required
            maxlength="80"
            :disabled="saving"
            placeholder="Например, Закуски"
        /></label>
        <label
          >Адрес категории<input
            v-model="id"
            required
            maxlength="40"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            :readonly="!!selected"
            :disabled="saving"
            placeholder="snacks"
        /></label>
        <p class="muted">
          Адрес пишется латиницей и остаётся постоянным. Переименование меняет
          название в каталоге и рецептах.
        </p>
        <div class="category-actions">
          <button class="primary" :disabled="saving">
            <span v-if="saving" class="spinner" />{{
              saving ? "Сохраняем…" : "Сохранить категорию"
            }}</button
          ><button
            v-if="selected"
            class="secondary"
            type="button"
            :disabled="saving"
            @click="edit()"
          >
            Новая категория
          </button>
        </div>
      </form>
    </div>
    <AppModal
      v-if="deleting"
      title="Удалить категорию?"
      @close="!saving && (deleting = undefined)"
    >
      <p>
        Категория «{{ deleting.title }}» будет удалена. Если она используется в
        опубликованном рецепте или черновике, сначала выберите для него другую
        категорию.
      </p>
      <template #footer
        ><div class="category-actions">
          <button
            class="secondary"
            :disabled="saving"
            @click="deleting = undefined"
          >
            Отмена</button
          ><button class="primary" :disabled="saving" @click="remove">
            {{ saving ? "Удаляем…" : "Удалить категорию" }}
          </button>
        </div></template
      >
    </AppModal>
  </div>
</template>
<style scoped>
.category-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}
.category-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.category-name {
  flex: 1;
  min-width: 0;
  text-align: left;
  background: none;
  border: 0;
}
.category-name strong,
.category-name small {
  display: block;
  overflow-wrap: anywhere;
}
.category-name small {
  color: var(--muted);
  font-size: 12px;
  margin-top: 4px;
}
.category-delete {
  color: var(--danger);
}
.category-form {
  display: grid;
  gap: 16px;
  padding: 24px;
}
.category-form h2 {
  font-size: 20px;
  margin: 0;
}
.category-form label {
  display: grid;
  gap: 8px;
}
.category-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.category-form p {
  font-size: 13px;
}
@media (max-width: 700px) {
  .category-layout {
    grid-template-columns: 1fr;
  }
  .category-form {
    padding: 16px;
  }
  .category-row {
    gap: 8px;
  }
}
</style>
