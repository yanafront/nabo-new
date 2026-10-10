type Metrika = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
export default defineNuxtPlugin((app) => {
  if (
    import.meta.dev ||
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  )
    return;
  const { analytics } = useCookieChoice();
  const browser = window as Window & { ym?: Metrika; dataLayer?: unknown[] };
  const counter = 113355204;
  let started = false;
  let previous = "";
  const safeUrl = () => window.location.origin + window.location.pathname;
  function pageView() {
    if (
      !analytics.value ||
      !started ||
      window.location.pathname.startsWith("/account") ||
      window.location.pathname.startsWith("/admin")
    )
      return;
    const url = safeUrl();
    if (previous === url) return;
    browser.ym?.(counter, "hit", url, {
      referer: previous,
      title: document.title,
    });
    previous = url;
  }
  function start() {
    if (!analytics.value || started) return;
    started = true;
    browser.dataLayer ||= [];
    browser.ym ||= Object.assign(
      (...args: unknown[]) => {
        (browser.ym!.a ||= []).push(args);
      },
      { l: Date.now() },
    );
    const source = `https://mc.yandex.ru/metrika/tag.js?id=${counter}`;
    if (!Array.from(document.scripts).some((script) => script.src === source)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = source;
      document.head.appendChild(script);
    }
    browser.ym(counter, "init", {
      ssr: true,
      defer: true,
      webvisor: false,
      clickmap: false,
      accurateTrackBounce: true,
      trackLinks: false,
    });
    pageView();
  }
  app.hook("app:mounted", start);
  watch(analytics, (allow) => {
    if (allow) start();
    else if (started) {
      browser.ym?.(counter, "destruct");
      started = false;
      previous = "";
    }
  });
  useRouter().afterEach((_to, _from, failure) => {
    if (!failure) nextTick(pageView);
  });
});
