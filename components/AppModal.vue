<script setup lang="ts">
const props = defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
let previous: HTMLElement | null = null;
onMounted(() => {
  previous = document.activeElement as HTMLElement;
  dialog.value?.showModal();
});
onBeforeUnmount(() => previous?.focus());
</script>
<template>
  <dialog
    ref="dialog"
    class="modal"
    aria-labelledby="modal-title"
    @cancel.prevent="emit('close')"
    @click="
      (e) => {
        if (e.target === dialog) emit('close');
      }
    "
  >
    <div class="modal-head">
      <h2 id="modal-title">{{ props.title }}</h2>
      <button class="icon-button" aria-label="Закрыть" @click="emit('close')">
        <AppIcon name="X" />
      </button>
    </div>
    <slot />
  </dialog>
</template>
