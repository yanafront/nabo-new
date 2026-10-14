export function useCookieChoice() {
  const choice = useCookie<{
    analytics: boolean;
    version: string;
    expires: number;
  } | null>("nabo-cookie-choice", {
    default: () => null,
    maxAge: 180 * 86400,
    sameSite: "lax",
    path: "/",
  });
  const valid = computed(
    () =>
      choice.value?.version === "2026-10-14" &&
      choice.value.expires > Date.now(),
  );
  const analytics = computed(
    () => valid.value && choice.value?.analytics === true,
  );
  const open = useState("cookie-settings-open", () => false);
  function choose(allow: boolean) {
    const revoke = analytics.value && !allow;
    choice.value = {
      analytics: allow,
      version: "2026-10-14",
      expires: Date.now() + 180 * 86400 * 1000,
    };
    open.value = false;
    if (revoke && import.meta.client) {
      const browser = window as Window & {
        ym?: (...args: unknown[]) => void;
        gtag?: (...args: unknown[]) => void;
        "ga-disable-G-MREKXGH3TP"?: boolean;
      };
      browser.ym?.(113355204, "destruct");
      browser["ga-disable-G-MREKXGH3TP"] = true;
      browser.gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      document.cookie
        .split(";")
        .map((value) => value.trim().split("=")[0])
        .filter(
          (name) =>
            name.startsWith("_ym_") ||
            name === "_ga" ||
            name.startsWith("_ga_") ||
            name === "_gid",
        )
        .forEach((name) => {
          const domains = [
            "",
            window.location.hostname,
            `.${window.location.hostname}`,
          ];
          domains.forEach((domain) => {
            document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}; SameSite=Lax`;
          });
        });
      window.location.reload();
    }
  }
  return { choice, valid, analytics, open, choose };
}
