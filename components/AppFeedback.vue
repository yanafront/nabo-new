<script setup lang="ts">
import type { ToastKind } from "~/composables/useToast";
const props = withDefaults(
  defineProps<{
    message?: string | null;
    kind?: ToastKind;
    actionLabel?: string;
  }>(),
  { kind: "error" },
);
const emit = defineEmits<{ action: [] }>();
const { show, dismiss } = useToast();
let id: string | undefined;
watch(
  () => props.message,
  (message) => {
    if (message)
      id = show(
        message,
        props.kind,
        props.actionLabel,
        props.actionLabel ? () => emit("action") : undefined,
      );
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (id && props.actionLabel) dismiss(id);
});
</script>
<template></template>
