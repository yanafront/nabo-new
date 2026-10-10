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
      choice.value?.version === "2026-10-10" &&
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
      version: "2026-10-10",
      expires: Date.now() + 180 * 86400 * 1000,
    };
    open.value = false;
    if (revoke && import.meta.client) {
      const browser = window as Window & { ym?: (...args: unknown[]) => void };
      browser.ym?.(113355204, "destruct");
      document.cookie
        .split(";")
        .map((value) => value.trim().split("=")[0])
        .filter((name) => name.startsWith("_ym_"))
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
