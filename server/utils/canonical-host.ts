// Vercel may still redirect the apex before Nitro sees it. Do not introduce a
// www -> apex -> www loop during the domain migration. Once the platform serves
// the apex, the canonical redirect enables itself (cache <= 60 seconds).
let cached: { expires: number; ready: boolean } | undefined;
let flight: Promise<boolean> | undefined;
export async function apexIsServing(): Promise<boolean> {
  if (cached && cached.expires > Date.now()) return cached.ready;
  if (flight) return flight;
  flight = (async () => {
    let ready = false;
    try {
      const response = await fetch("https://nabo.by/robots.txt", {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(2000),
      });
      ready = response.status === 200;
    } catch {
      /* Keep the page reachable on a platform/network failure. */
    }
    cached = { expires: Date.now() + 60000, ready };
    return ready;
  })();
  try {
    return await flight;
  } finally {
    flight = undefined;
  }
}
