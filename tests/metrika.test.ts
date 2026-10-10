import { afterEach, beforeEach, expect, it, vi } from "vitest";
let hooks: Record<string, () => void>;
let navigate: (_to: unknown, _from: unknown, failure?: unknown) => void;
let consent: { value: boolean };
let changed: (allow: boolean) => void;
let browser: any;
let scripts: any[];
beforeEach(() => {
  vi.resetModules();
  hooks = {};
  consent = { value: false };
  scripts = [];
  browser = {
    location: {
      hostname: "nabo-new.vercel.app",
      origin: "https://nabo-new.vercel.app",
      pathname: "/",
      href: "https://nabo-new.vercel.app/",
    },
  };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", {
    scripts,
    title: "Nabo",
    createElement: () => ({ src: "", async: false }),
    head: { appendChild: (script: any) => scripts.push(script) },
  });
  vi.stubGlobal("defineNuxtPlugin", (plugin: unknown) => plugin);
  vi.stubGlobal("useCookieChoice", () => ({ analytics: consent }));
  vi.stubGlobal("watch", (_source: unknown, callback: typeof changed) => {
    changed = callback;
  });
  vi.stubGlobal("useRouter", () => ({
    afterEach: (callback: typeof navigate) => {
      navigate = callback;
    },
  }));
  vi.stubGlobal("nextTick", (callback: () => void) =>
    Promise.resolve().then(callback),
  );
});
afterEach(() => vi.unstubAllGlobals());
async function install() {
  const plugin = (await import("../plugins/metrika.client")).default;
  (plugin as any)({
    hook: (name: string, callback: () => void) => {
      hooks[name] = callback;
    },
  });
}
it("does not load analytics without an explicit opt-in", async () => {
  await install();
  hooks["app:mounted"]!();
  navigate({}, {});
  await Promise.resolve();
  expect(scripts).toHaveLength(0);
  expect(browser.ym).toBeUndefined();
});
it("loads once after opt-in, with recording disabled and no query parameters", async () => {
  await install();
  hooks["app:mounted"]!();
  browser.location.href += "?lat=53.9&phone=private";
  consent.value = true;
  changed(true);
  expect(scripts).toEqual([
    { src: "https://mc.yandex.ru/metrika/tag.js?id=113355204", async: true },
  ]);
  expect(browser.ym.a[0]).toEqual([
    113355204,
    "init",
    expect.objectContaining({
      webvisor: false,
      clickmap: false,
      trackLinks: false,
      defer: true,
    }),
  ]);
  expect(browser.ym.a[1][2]).toBe("https://nabo-new.vercel.app/");
  navigate({}, {});
  await Promise.resolve();
  expect(browser.ym.a).toHaveLength(2);
});
it("counts SPA transitions once and excludes account and admin pages", async () => {
  consent.value = true;
  await install();
  hooks["app:mounted"]!();
  browser.location.pathname = "/recipes";
  navigate({}, {});
  await Promise.resolve();
  expect(browser.ym.a[2]).toEqual([
    113355204,
    "hit",
    "https://nabo-new.vercel.app/recipes",
    { referer: "https://nabo-new.vercel.app/", title: "Nabo" },
  ]);
  browser.location.pathname = "/account";
  navigate({}, {});
  await Promise.resolve();
  browser.location.pathname = "/admin/recipes";
  navigate({}, {});
  await Promise.resolve();
  expect(browser.ym.a).toHaveLength(3);
  consent.value = false;
  changed(false);
  expect(browser.ym.a.at(-1)).toEqual([113355204, "destruct"]);
  navigate({}, {});
  await Promise.resolve();
  expect(browser.ym.a).toHaveLength(4);
});
it("keeps localhost visits out of analytics", async () => {
  browser.location.hostname = "127.0.0.1";
  await install();
  expect(scripts).toHaveLength(0);
  expect(browser.ym).toBeUndefined();
});
it("does not insert the same script twice", async () => {
  consent.value = true;
  scripts.push({ src: "https://mc.yandex.ru/metrika/tag.js?id=113355204" });
  await install();
  hooks["app:mounted"]!();
  expect(scripts).toHaveLength(1);
});
