<script setup lang="ts">
const route = useRoute();
const showProducts = computed(() => route.query.tab !== "baskets");
import { products } from "~/data/catalog";
const { saved, items, title, pendingIngredients, unresolved } = useBasket();
function restore(id: string) {
  const basket = saved.value.find((s) => s.id === id);
  if (basket) {
    const restored = JSON.parse(
      JSON.stringify(basket.items),
    ) as typeof items.value;
    items.value = restored.filter((i) => i.product?.sourceId);
    pendingIngredients.value = restored.filter((i) => !i.product?.sourceId);
    unresolved.value = [];
    title.value = basket.title;
    navigateTo("/basket");
  }
}
</script>
<template>
  <div class="inner-page">
    <div class="page-heading">
      <div>
        <div class="eyebrow small"></div>
        <h1>Сохранённое</h1>
        <p class="muted">
          {{
            showProducts
              ? "Ваши любимые товары из всех магазинов."
              : "Корзина аккаунта и списки для повторных покупок."
          }}
        </p>
      </div>
    </div>
    <nav class="saved-tabs" aria-label="Разделы сохранённого">
      <NuxtLink
        to="/saved?tab=products"
        :class="{ active: showProducts }"
        :aria-current="showProducts ? 'page' : undefined"
        >Любимые товары</NuxtLink
      >
      <NuxtLink
        to="/saved?tab=baskets"
        :class="{ active: !showProducts }"
        :aria-current="!showProducts ? 'page' : undefined"
        >Корзины</NuxtLink
      >
    </nav>
    <FavoriteProducts v-if="showProducts" />
    <template v-else>
      <AccountCart />
      <h2 v-if="saved.length">Списки в этом браузере</h2>
      <div v-if="saved.length" class="saved-grid">
        <article
          v-for="basket in saved"
          :key="basket.id"
          class="panel saved-card"
        >
          <div class="saved-emojis">
            {{
              basket.items
                .slice(0, 4)
                .map(
                  (i) =>
                    i.product?.emoji ||
                    products.find((p) => p.id === i.productId)?.emoji,
                )
                .join(" ")
            }}
          </div>
          <h2>{{ basket.title }}</h2>
          <p class="muted">
            {{
              quantityLabel(
                basket.items.length,
                "позиция",
                "позиции",
                "позиций",
              )
            }}
            · {{ basket.date }}
          </p>
          <div>
            <button class="primary" @click="restore(basket.id)">
              Повторить покупки <AppIcon name="ArrowRight" :size="17" /></button
            ><button
              class="icon-button"
              :aria-label="`Удалить сохранённую корзину ${basket.title}`"
              @click="saved = saved.filter((s) => s.id !== basket.id)"
            >
              <AppIcon name="Trash2" :size="18" />
            </button>
          </div>
        </article>
      </div>
      <div v-else class="empty-state">
        <span>♡</span>
        <h2>Место для ваших любимых корзин</h2>
        <p>
          Соберите первую и нажмите «Сохранить список»,<br />чтобы в следующий
          раз начать с готового.
        </p>
        <NuxtLink to="/products" class="primary"
          >Найти товары <AppIcon name="ArrowRight"
        /></NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.saved-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--line);
}
.saved-tabs a {
  padding: 12px 16px;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  font-weight: 600;
}
.saved-tabs a.active {
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}
@media (max-width: 600px) {
  .saved-tabs a {
    padding: 10px 12px;
    font-size: 13px;
  }
}
</style>
