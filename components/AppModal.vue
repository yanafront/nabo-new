<script setup lang="ts">
const props = defineProps<{ title: string; variant?: "drawer" }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
let previous: HTMLElement | null = null;
let pressedOutside = false;
let previousOverflow = "";
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
  if (props.variant === "drawer") {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  dialog.value?.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  if (props.variant === "drawer")
    document.body.style.overflow = previousOverflow;
  previous?.focus();
});
</script>
<template>
  <dialog
    ref="dialog"
    class="modal"
    :class="{ 'modal-drawer': variant === 'drawer' }"
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

<style scoped>
.modal.modal-drawer {
  position: fixed;
  inset: 0 0 0 auto;
  margin: 0;
  width: min(480px, 100vw);
  max-width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  padding: 0;
  border: 0;
  border-radius: 20px 0 0 20px;
  overflow: hidden;
}
.modal-drawer[open] {
  display: flex;
  flex-direction: column;
  animation: drawer-enter 0.2s ease-out;
}
.modal-drawer .modal-head {
  top: 0;
  flex-shrink: 0;
  margin: 0;
  padding: 18px 20px;
  border-bottom: 1px solid var(--line);
}
.modal-drawer .modal-head h2 {
  font-size: 22px;
}
@keyframes drawer-enter {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
@media (max-width: 600px) {
  .modal.modal-drawer {
    width: 100vw;
    border-radius: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .modal-drawer[open] {
    animation: none;
  }
}
</style>
