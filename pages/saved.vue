<script setup lang="ts">
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
        <h1>Ваши сохранённые</h1>
        <p class="muted">Корзины на этом устройстве.</p>
      </div>
    </div>
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
          {{ basket.items.length }} позиций · {{ basket.date }}
        </p>
        <div>
          <button class="primary" @click="restore(basket.id)">
            Открыть корзину <AppIcon name="ArrowRight" :size="17" /></button
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
        Соберите первую и нажмите «Сохранить»,<br />чтобы в следующий раз начать
        с готового.
      </p>
      <NuxtLink to="/" class="primary"
        >Найти вкусную идею <AppIcon name="ArrowRight"
      /></NuxtLink>
    </div>
  </div>
</template>
