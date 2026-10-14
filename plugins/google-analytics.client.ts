type GoogleTag = (...args: unknown[]) => void;
const measurementId = "G-MREKXGH3TP";
export default defineNuxtPlugin((app) => {
  if (
    import.meta.dev ||
    ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)
  )
    return;
  const { analytics } = useCookieChoice();
  const browser = window as Window & {
    dataLayer?: unknown[];
    gtag?: GoogleTag;
    "ga-disable-G-MREKXGH3TP"?: boolean;
  };
  let started = false,
    previous = "";
  const privatePage = () =>
    /^\/(account|admin)(\/|$)/.test(window.location.pathname);
  const safeUrl = () => window.location.origin + window.location.pathname;
  const initialReferrer = () => {
    try {
      const url = new URL(document.referrer);
      if (
        url.origin === window.location.origin &&
        /^\/(account|admin)(\/|$)/.test(url.pathname)
      )
        return "";
      return url.origin;
    } catch {
      return "";
    }
  };
  function pageView() {
    browser[`ga-disable-${measurementId}`] = !analytics.value || privatePage();
    if (!analytics.value || privatePage()) return;
    if (!started) {
      started = true;
      browser.dataLayer ||= [];
      browser.gtag ||= function () {
        browser.dataLayer!.push(arguments);
      };
      browser.gtag("consent", "default", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      browser.gtag("js", new Date());
      browser.gtag("config", measurementId, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: safeUrl(),
        page_referrer: initialReferrer(),
      });
      const source = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      if (
        !Array.from(document.scripts).some((script) => script.src === source)
      ) {
        const script = document.createElement("script");
        script.async = true;
        script.src = source;
        document.head.appendChild(script);
      }
    }
    const url = safeUrl();
    if (url === previous) return;
    browser.gtag?.("event", "page_view", {
      send_to: measurementId,
      page_location: url,
      page_title: document.title,
      page_referrer: previous || initialReferrer(),
    });
    previous = url;
  }
  app.hook("app:mounted", pageView);
  app.hook("page:finish", pageView);
  useRouter().afterEach((_to, _from, failure) => {
    if (!failure)
      browser[`ga-disable-${measurementId}`] =
        !analytics.value || privatePage();
  });
  watch(analytics, (allow) => {
    if (allow) pageView();
    else {
      browser[`ga-disable-${measurementId}`] = true;
      browser.gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      previous = "";
    }
  });
});
