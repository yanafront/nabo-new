<script setup lang="ts">
const props = defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
let previous: HTMLElement | null = null;
let pressedOutside = false;
function outsideDialog(event: MouseEvent) {
  const bounds = dialog.value?.getBoundingClientRect();
  return (
    !!bounds &&
    (event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom)
  );
}
function startPointer(event: PointerEvent) {
  pressedOutside = event.button === 0 && outsideDialog(event);
}
function closeFromBackdrop(event: MouseEvent) {
  // The dialog itself is also the target of clicks on its internal padding.
  // Only dismiss a gesture that both starts and ends outside its bounds.
  const shouldClose =
    pressedOutside &&
    event.detail > 0 &&
    event.target === dialog.value &&
    outsideDialog(event);
  pressedOutside = false;
  if (shouldClose) emit("close");
}
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
    @pointerdown.capture="startPointer"
    @click="closeFromBackdrop"
  >
    <div class="modal-head">
      <h2 id="modal-title">{{ props.title }}</h2>
      <button
        type="button"
        class="icon-button"
        aria-label="Закрыть"
        @click="emit('close')"
      >
        <AppIcon name="X" />
      </button>
    </div>
    <slot />
    <slot name="footer" />
  </dialog>
</template>
