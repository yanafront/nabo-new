<script setup lang="ts">
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{
          isFinal: boolean;
          [key: number]: { transcript: string };
        }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
const emit = defineEmits<{ result: [text: string] }>();
const listening = ref(false);
const toast = useToast();
let recognition: Recognition | undefined;
let disposed = false;
function toggle() {
  if (listening.value) {
    try {
      recognition?.stop();
    } catch {
      listening.value = false;
    }
    return;
  }
  const Speech =
    (
      window as unknown as {
        SpeechRecognition?: new () => Recognition;
        webkitSpeechRecognition?: new () => Recognition;
      }
    ).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => Recognition })
      .webkitSpeechRecognition;
  if (!Speech) {
    toast.show(
      "В этом браузере голосовой ввод недоступен. Используйте голосовую клавиатуру устройства или введите запрос текстом.",
      "info",
    );
    return;
  }
  const session = new Speech();
  recognition = session;
  let text = "",
    failed = false;
  session.lang = "ru-RU";
  session.continuous = false;
  session.interimResults = false;
  session.onresult = (event) => {
    if (recognition !== session || disposed) return;
    text = Array.from(event.results)
      .filter((r) => r.isFinal)
      .map((r) => r[0]?.transcript || "")
      .join(" ")
      .trim();
  };
  session.onerror = (event) => {
    if (recognition !== session || disposed) return;
    failed = true;
    listening.value = false;
    const messages: Record<string, string> = {
      "not-allowed": "Разрешите доступ к микрофону в настройках браузера.",
      "service-not-allowed":
        "Браузер не разрешил распознавание речи. Используйте голосовую клавиатуру устройства.",
      "audio-capture": "Микрофон не найден или занят другим приложением.",
      network:
        "Не удалось подключиться к распознаванию речи. Проверьте интернет и повторите.",
      "no-speech":
        "Не удалось услышать запрос. Нажмите микрофон и попробуйте ещё раз.",
    };
    if (!disposed && event.error !== "aborted")
      toast.show(
        messages[event.error] ||
          "Не удалось распознать речь. Попробуйте ещё раз или введите запрос текстом.",
        "error",
      );
  };
  session.onend = () => {
    if (recognition !== session) return;
    listening.value = false;
    recognition = undefined;
    if (!disposed && !failed && text) emit("result", text.slice(0, 160));
  };
  try {
    listening.value = true;
    session.start();
  } catch {
    listening.value = false;
    recognition = undefined;
    toast.show(
      "Не удалось включить микрофон. Проверьте разрешение браузера.",
      "error",
    );
  }
}
onBeforeUnmount(() => {
  disposed = true;
  if (recognition) {
    recognition.onend = null;
    recognition.onerror = null;
    recognition.onresult = null;
    recognition.abort();
  }
});
</script>
<template>
  <button
    type="button"
    class="voice-search-button"
    :class="{ listening }"
    :aria-pressed="listening"
    :aria-label="listening ? 'Остановить голосовой ввод' : 'Ввести голосом'"
    :title="listening ? 'Слушаю… Нажмите, чтобы остановить' : 'Голосовой ввод'"
    @click="toggle"
  >
    <AppIcon :name="listening ? 'X' : 'Mic'" :size="20" /><span
      class="voice-status"
      role="status"
      >{{ listening ? "Слушаю ваш запрос" : "" }}</span
    >
  </button>
</template>
<style scoped>
.voice-search-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  min-height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
}
.voice-search-button:hover {
  background: var(--brand-soft);
  color: var(--ink);
}
.voice-search-button.listening {
  background: var(--brand);
  color: var(--ink);
}
.voice-status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (max-width: 400px) {
  .voice-search-button {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
    min-height: 36px;
  }
}
</style>
