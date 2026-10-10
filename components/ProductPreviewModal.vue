<script setup lang="ts">
const { selected, close } = useProductPreview();
const route = useRoute();
let previousOverflow = "";
onMounted(() => {
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
});
onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow;
});
watch(() => route.path, close);
</script>
<template>
  <AppModal
    v-if="selected"
    title="Карточка товара"
    class="product-preview-modal"
    @close="close"
  >
    <ProductDetails
      :key="`${selected.storeId}:${selected.id}`"
      :store-id="selected.storeId"
      :product-id="selected.id"
      :initial-name="selected.name"
      :replace-id="selected.replaceId"
      :snapshot="selected.product"
      modal
      @done="close"
    />
  </AppModal>
</template>
<style>
.product-preview-modal {
  position: fixed;
  inset: 0;
  margin: auto;
  border: 1px solid var(--line);
  width: min(820px, calc(100vw - 32px));
  padding: 0;
  max-height: min(88dvh, 860px);
  overflow: hidden;
}
.product-preview-modal[open] {
  display: flex;
  flex-direction: column;
}
.product-preview-modal .modal-head {
  position: static;
  flex-shrink: 0;
  padding: 12px 24px;
  margin: 0;
  border-bottom: 1px solid var(--line);
}
.product-preview-modal .modal-head h2 {
  font-size: 16px;
}
@media (max-width: 600px) {
  .product-preview-modal {
    width: calc(100vw - 16px);
    max-height: 94dvh;
    border-radius: 18px;
  }
  .product-preview-modal .modal-head {
    padding: 8px 16px;
  }
}
</style>
