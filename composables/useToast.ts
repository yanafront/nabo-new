export type ToastKind = "info" | "success" | "error";
export interface ToastMessage {
  id: string;
  message: string;
  kind: ToastKind;
  actionLabel?: string;
  action?: () => void;
  durationMs?: number;
}
export function useToast() {
  const messages = useState<ToastMessage[]>("toast-messages", () => []);
  const dismiss = (id: string) => {
    messages.value = messages.value.filter((item) => item.id !== id);
  };
  function show(
    message: string,
    kind: ToastKind = "info",
    actionLabel?: string,
    action?: () => void,
    durationMs?: number,
  ) {
    if (!import.meta.client || !message.trim()) return;
    const duplicate = messages.value.find(
      (item) => item.message === message && item.kind === kind,
    );
    if (duplicate) return duplicate.id;
    const id = crypto.randomUUID();
    messages.value = [
      ...messages.value.slice(-2),
      { id, message, kind, actionLabel, action, durationMs },
    ];
    return id;
  }
  return { messages, show, dismiss };
}
