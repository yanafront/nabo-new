import { beforeEach, afterEach, it, expect, vi } from "vitest";
let browser: any,
  scripts: any[],
  hooks: Record<string, () => void>,
  consent: { value: boolean },
  change: (v: boolean) => void;
beforeEach(() => {
  vi.resetModules();
  scripts = [];
  hooks = {};
  consent = { value: false };
  browser = {
    location: {
      hostname: "nabo-new.vercel.app",
      origin: "https://nabo-new.vercel.app",
      pathname: "/",
      href: "https://nabo-new.vercel.app/?phone=secret",
    },
  };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", {
    scripts,
    title: "Nabo",
    referrer: "https://google.com/search?q=private",
    createElement: () => ({ src: "", async: false }),
    head: { appendChild: (s: any) => scripts.push(s) },
  });
  vi.stubGlobal("defineNuxtPlugin", (p: unknown) => p);
  vi.stubGlobal("useCookieChoice", () => ({ analytics: consent }));
  vi.stubGlobal("watch", (_s: unknown, cb: typeof change) => {
    change = cb;
  });
  vi.stubGlobal("useRouter", () => ({ afterEach: () => {} }));
});
afterEach(() => vi.unstubAllGlobals());
async function install() {
  const p = (await import("../plugins/google-analytics.client")).default;
  (p as any)({
    hook: (name: string, cb: () => void) => {
      hooks[name] = cb;
    },
  });
}
const calls = () =>
  browser.dataLayer?.map((v: IArguments) => Array.from(v)) || [];
it("never loads Google until analytics consent", async () => {
  await install();
  hooks["app:mounted"]!();
  expect(scripts).toHaveLength(0);
  consent.value = true;
  change(true);
  expect(scripts[0].src).toContain("G-MREKXGH3TP");
  expect(calls().find((c: any) => c[0] === "config")[2]).toMatchObject({
    send_page_view: false,
    allow_google_signals: false,
  });
  expect(calls().find((c: any) => c[1] === "page_view")[2]).toMatchObject({
    page_location: "https://nabo-new.vercel.app/",
    page_referrer: "https://google.com",
  });
});
it("counts SPA pages once and blocks account/admin and revoked consent", async () => {
  consent.value = true;
  await install();
  hooks["app:mounted"]!();
  hooks["page:finish"]!();
  expect(calls().filter((c: any) => c[1] === "page_view")).toHaveLength(1);
  browser.location.pathname = "/recipes";
  hooks["page:finish"]!();
  expect(calls().filter((c: any) => c[1] === "page_view")).toHaveLength(2);
  browser.location.pathname = "/admin/recipes";
  hooks["page:finish"]!();
  expect(browser["ga-disable-G-MREKXGH3TP"]).toBe(true);
  expect(calls().filter((c: any) => c[1] === "page_view")).toHaveLength(2);
  consent.value = false;
  change(false);
  browser.location.pathname = "/basket";
  hooks["page:finish"]!();
  expect(calls().filter((c: any) => c[1] === "page_view")).toHaveLength(2);
});
it("does not load Google on a private initial page or localhost", async () => {
  consent.value = true;
  browser.location.pathname = "/account";
  await install();
  hooks["app:mounted"]!();
  expect(scripts).toHaveLength(0);
  browser.location.pathname = "/products";
  hooks["page:finish"]!();
  expect(scripts).toHaveLength(1);
});
