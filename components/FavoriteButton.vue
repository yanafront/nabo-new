<script setup lang="ts">
import type { StoreId } from "~/shared/yandex";
const props = defineProps<{ storeId: StoreId; id: string; name?: string }>();
const route = useRoute();
const { has, key, busy, load, toggle } = useFavorites();
const reference = computed(() => ({ storeId: props.storeId, id: props.id }));
const selected = computed(() => has(reference.value));
onMounted(() => load());
</script>
<template>
  <button
    type="button"
    class="favorite-button icon-button"
    :class="{ 'is-favorite': selected }"
    :aria-pressed="selected"
    :aria-label="`${selected ? 'Удалить из любимых' : 'Добавить в любимые'}: ${name || 'товар'}`"
    :title="selected ? 'Удалить из любимых' : 'Добавить в любимые'"
    :disabled="busy[key(reference)]"
    @click.stop="toggle(reference, route.fullPath)"
  >
    <AppIcon name="Heart" :size="20" />
  </button>
</template>
<style scoped>
.favorite-button {
  flex: 0 0 auto;
  min-width: 40px;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: white;
  color: var(--muted);
}
.favorite-button.is-favorite {
  color: var(--accent-blue);
}
.favorite-button.is-favorite :deep(svg) {
  fill: currentColor;
}
.favorite-button:disabled {
  opacity: 0.55;
}
</style>
