type Metrika = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

export default defineNuxtPlugin((app) => {
  // Keep development visits out of the site's analytics.
  if (
    import.meta.dev ||
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  )
    return;
  const counter = 113355204;
  const browser = window as Window & { ym?: Metrika; dataLayer?: unknown[] };
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
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: window.location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
  let mounted = false;
  let previous = "";
  function pageView() {
    const url = window.location.href;
    if (!mounted || url === previous) return;
    browser.ym!(counter, "hit", url, {
      referer: previous || document.referrer,
      title: document.title,
    });
    previous = url;
  }
  app.hook("app:mounted", () => {
    mounted = true;
    pageView();
  });
  const router = useRouter();
  router.afterEach((_to, _from, failure) => {
    if (!failure) nextTick(pageView);
  });
});
