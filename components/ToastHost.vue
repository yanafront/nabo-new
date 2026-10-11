<script setup lang="ts">
const { messages, dismiss } = useToast();
const target = shallowRef<string | HTMLElement>("body");
const modalPosition = ref<Record<string, string>>();
let dialogs: MutationObserver | undefined;
let removeResize: (() => void) | undefined;
onMounted(() => {
  const updateTarget = () => {
    const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
    target.value = open[open.length - 1] || "body";
    const dialog = open[open.length - 1];
    const box = dialog?.getBoundingClientRect();
    const next = box
      ? {
          top: `${box.top + 12}px`,
          right: `${innerWidth - box.right + 12}px`,
          width: `${Math.min(400, box.width - 24)}px`,
        }
      : undefined;
    if (JSON.stringify(next) !== JSON.stringify(modalPosition.value))
      modalPosition.value = next;
  };
  updateTarget();
  window.addEventListener("resize", updateTarget);
  removeResize = () => window.removeEventListener("resize", updateTarget);
  dialogs = new MutationObserver(updateTarget);
  dialogs.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });
});
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function pause(id: string) {
  clearTimeout(timers.get(id));
  timers.delete(id);
}
function resume(id: string) {
  pause(id);
  const item = messages.value.find((message) => message.id === id);
  if (item && item.durationMs !== 0)
    timers.set(
      id,
      setTimeout(
        () => dismiss(id),
        item.durationMs ?? (item.kind === "error" ? 9000 : 5000),
      ),
    );
}
watch(
  messages,
  (rows) => {
    for (const id of timers.keys())
      if (!rows.some((row) => row.id === id)) pause(id);
    for (const row of rows) if (!timers.has(row.id)) resume(row.id);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  dialogs?.disconnect();
  removeResize?.();
  for (const id of timers.keys()) pause(id);
});
</script>
<template>
  <Teleport :to="target">
    <TransitionGroup
      name="nabo-toast"
      tag="div"
      class="toast-stack"
      :style="modalPosition"
      aria-label="Уведомления"
    >
      <div
        v-for="item in messages"
        :key="item.id"
        class="nabo-toast"
        :class="`nabo-toast--${item.kind}`"
        :role="item.kind === 'error' ? 'alert' : 'status'"
        @mouseenter="pause(item.id)"
        @mouseleave="resume(item.id)"
        @focusin="pause(item.id)"
        @focusout="resume(item.id)"
      >
        <span class="nabo-toast-icon"
          ><AppIcon
            :name="
              item.kind === 'error'
                ? 'CircleAlert'
                : item.kind === 'success'
                  ? 'Check'
                  : 'Info'
            "
            :size="20"
        /></span>
        <div class="nabo-toast-copy">
          <p>{{ item.message }}</p>
          <button
            v-if="item.actionLabel"
            class="nabo-toast-action"
            @click="item.action?.()"
          >
            {{ item.actionLabel }}
          </button>
        </div>
        <button
          class="nabo-toast-close"
          aria-label="Закрыть уведомление"
          @click="dismiss(item.id)"
        >
          <AppIcon name="X" :size="18" />
        </button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>
<style scoped>
.toast-stack {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top));
  right: 20px;
  z-index: 2000;
  width: min(400px, calc(100vw - 32px));
  display: grid;
  gap: 10px;
  pointer-events: none;
}
.nabo-toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 10px 12px 14px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 6px 24px rgb(15 15 16 / 12%);
  pointer-events: auto;
}
.nabo-toast-icon {
  display: grid;
  place-items: center;
  flex: 0 0 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--brand-soft);
  color: var(--ink);
}
.nabo-toast--success {
  border-color: #dceeb5;
}
.nabo-toast--success .nabo-toast-icon {
  background: var(--brand);
}
.nabo-toast--error {
  border-color: #e9d8e2;
}
.nabo-toast--error .nabo-toast-icon {
  color: var(--danger);
  background: var(--danger-soft);
}
.nabo-toast-copy {
  flex: 1;
  min-width: 0;
  padding-top: 5px;
  font-size: 13px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.nabo-toast-copy p {
  margin: 0;
}
.nabo-toast-action {
  padding: 6px 0 0;
  min-height: 32px;
  font-weight: 600;
  text-align: left;
  text-decoration: underline;
}
.nabo-toast-close {
  flex: 0 0 36px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--muted);
}
.nabo-toast-close:hover {
  background: var(--brand-soft);
}
.nabo-toast-enter-active,
.nabo-toast-leave-active,
.nabo-toast-move {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}
.nabo-toast-enter-from,
.nabo-toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
@media (max-width: 760px) {
  .toast-stack {
    right: 16px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .nabo-toast-enter-active,
  .nabo-toast-leave-active,
  .nabo-toast-move {
    transition: none;
  }
}
</style>
