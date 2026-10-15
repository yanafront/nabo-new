<script setup lang="ts">
const props = defineProps<{ title: string; variant?: "drawer" }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
let previous: HTMLElement | null = null;
let pressedOutside = false;
let previousOverflow = "";
function syncViewport() {
  const viewport = window.visualViewport;
  dialog.value?.style.setProperty(
    "--modal-viewport-height",
    `${viewport?.height || window.innerHeight}px`,
  );
  dialog.value?.style.setProperty(
    "--modal-viewport-top",
    `${viewport?.offsetTop || 0}px`,
  );
}
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
  syncViewport();
  window.visualViewport?.addEventListener("resize", syncViewport);
  window.visualViewport?.addEventListener("scroll", syncViewport);
  window.addEventListener("resize", syncViewport);
  dialog.value?.showModal();
});
onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener("resize", syncViewport);
  window.visualViewport?.removeEventListener("scroll", syncViewport);
  window.removeEventListener("resize", syncViewport);
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

<style scoped>
@media (max-width: 760px) {
  .modal[open] {
    position: fixed;
    inset: auto 0;
    top: calc(
      var(--modal-viewport-top, 0px) + var(--modal-viewport-height, 100dvh) / 2
    );
    bottom: auto;
    margin: 0 auto;
    translate: 0 -50%;
    width: calc(100% - 24px);
    max-width: calc(100% - 24px);
    max-height: calc(
      var(--modal-viewport-height, 100dvh) - 24px - env(safe-area-inset-top) -
        env(safe-area-inset-bottom)
    );
    border: 1px solid var(--line);
    border-radius: 20px;
  }
  .modal.modal-drawer[open] {
    height: calc(
      var(--modal-viewport-height, 100dvh) - 24px - env(safe-area-inset-top) -
        env(safe-area-inset-bottom)
    );
    animation: none;
  }
}
</style>
