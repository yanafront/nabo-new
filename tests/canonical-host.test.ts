import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("does not loop when Vercel redirects the apex back to www", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(null, {
          status: 308,
          headers: { location: "https://www.nabo.by/robots.txt" },
        }),
      ),
  );
  const { apexIsServing } = await import("../server/utils/canonical-host");
  expect(await apexIsServing()).toBe(false);
});
it("enables redirect only after the apex serves successfully and caches the probe", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", request);
  const { apexIsServing } = await import("../server/utils/canonical-host");
  expect(await apexIsServing()).toBe(true);
  expect(await apexIsServing()).toBe(true);
  expect(request).toHaveBeenCalledTimes(1);
});
it("keeps pages reachable when the migration probe fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  const { apexIsServing } = await import("../server/utils/canonical-host");
  expect(await apexIsServing()).toBe(false);
});
