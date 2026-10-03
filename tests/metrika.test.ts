import { afterEach, beforeEach, expect, it, vi } from "vitest";
let hooks: Record<string, () => void>;
let navigate: (_to: unknown, _from: unknown, failure?: unknown) => void;
let browser: {
  location: { hostname: string; href: string };
  ym?: any;
  dataLayer?: unknown[];
};
let doc: {
  scripts: Array<{ src: string }>;
  referrer: string;
  title: string;
  head: { appendChild: ReturnType<typeof vi.fn> };
};
beforeEach(() => {
  vi.resetModules();
  hooks = {};
  browser = {
    location: {
      hostname: "nabo-new.vercel.app",
      href: "https://nabo-new.vercel.app/",
    },
  };
  doc = {
    scripts: [],
    referrer: "https://example.com/",
    title: "Nabo",
    head: { appendChild: vi.fn((script) => doc.scripts.push(script)) },
  };
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", {
    ...doc,
    createElement: () => ({ src: "", async: false }),
  });
  vi.stubGlobal("defineNuxtPlugin", (plugin: unknown) => plugin);
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
it("loads the counter asynchronously and counts the first page exactly once after hydration", async () => {
  await install();
  expect(doc.scripts).toEqual([
    { src: "https://mc.yandex.ru/metrika/tag.js?id=113355204", async: true },
  ]);
  expect(browser.ym.a).toEqual([
    [
      113355204,
      "init",
      expect.objectContaining({
        defer: true,
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: "dataLayer",
        accurateTrackBounce: true,
        trackLinks: true,
      }),
    ],
  ]);
  navigate({}, {});
  await Promise.resolve();
  expect(browser.ym.a).toHaveLength(1);
  hooks["app:mounted"]!();
  expect(browser.ym.a[1]).toEqual([
    113355204,
    "hit",
    browser.location.href,
    { referer: doc.referrer, title: "Nabo" },
  ]);
  navigate({}, {});
  await Promise.resolve();
  expect(browser.ym.a).toHaveLength(2);
});
it("tracks SPA transitions with the previous URL and ignores duplicate or cancelled navigations", async () => {
  await install();
  hooks["app:mounted"]!();
  browser.location.href = "https://nabo-new.vercel.app/recipes";
  navigate({}, {});
  await Promise.resolve();
  expect(browser.ym.a[2]).toEqual([
    113355204,
    "hit",
    browser.location.href,
    { referer: "https://nabo-new.vercel.app/", title: "Nabo" },
  ]);
  navigate({}, {});
  await Promise.resolve();
  browser.location.href = "https://nabo-new.vercel.app/basket";
  navigate({}, {}, new Error("cancelled"));
  await Promise.resolve();
  expect(browser.ym.a).toHaveLength(3);
});
it("keeps localhost visits out of analytics", async () => {
  browser.location.hostname = "127.0.0.1";
  await install();
  expect(doc.head.appendChild).not.toHaveBeenCalled();
  expect(browser.ym).toBeUndefined();
});
it("does not insert the same external script twice", async () => {
  doc.scripts.push({ src: "https://mc.yandex.ru/metrika/tag.js?id=113355204" });
  await install();
  expect(doc.head.appendChild).not.toHaveBeenCalled();
});
