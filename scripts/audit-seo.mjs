// Anonymous, read-only production checks. Usage: node scripts/audit-seo.mjs [origin]
const origin = process.argv[2] || "https://nabo.by";
const paths = [
  "/",
  "/recipes",
  "/recipes/syrniki",
  "/recipes/quick",
  "/recipes/budget",
  "/products",
  "/products/moloko",
  "/stores/evroopt",
  "/cook-or-order",
  "/cook-or-order/syrniki",
  "/robots.txt",
  "/sitemap.xml",
  "/sitemaps/static.xml",
  "/this-page-does-not-exist",
  "/recipes/this-recipe-does-not-exist",
  "/products/this-product-does-not-exist",
  "/products?q=milk",
];
const report = {
  checkedAt: new Date().toISOString(),
  origin,
  pages: [],
  redirects: [],
  sitemaps: [],
};
async function inspect(path, userAgent = "Googlebot") {
  const response = await fetch(origin + path, {
    redirect: "manual",
    headers: { "user-agent": userAgent, accept: "text/html" },
    signal: AbortSignal.timeout(45000),
  });
  const html = await response.text();
  const meta = (name) =>
    html.match(
      new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`),
    )?.[1];
  const schemas = [];
  const schemaErrors = [];
  for (const match of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const value = JSON.parse(match[1]);
      schemas.push(
        ...(value["@graph"] || [value]).map((node) => node["@type"]),
      );
    } catch (error) {
      schemaErrors.push(error.message);
    }
  }
  const row = {
    path,
    userAgent,
    status: response.status,
    location: response.headers.get("location"),
    canonical: html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/)?.[1],
    title: html.match(/<title>([^<]*)<\/title>/)?.[1],
    robots: meta("robots"),
    xRobots: response.headers.get("x-robots-tag"),
    ogUrl: meta("og:url"),
    h1Count: [...html.matchAll(/<h1(?:\s|>)/g)].length,
    schemas,
    schemaErrors,
    staleSeoHost:
      /https:\/\/(?:www\.nabo\.by|nabo-new\.vercel\.app|localhost)[^"<\s]*/.test(
        html.split("</head>")[0],
      ),
  };
  report.pages.push(row);
  if (path === "/sitemap.xml" && response.ok)
    for (const match of html.matchAll(/<loc>([^<]+)<\/loc>/g))
      report.sitemaps.push(match[1]);
  return html;
}
for (const path of paths) {
  try {
    await inspect(path);
  } catch (error) {
    report.pages.push({ path, error: error.message });
  }
}
await inspect("/recipes/syrniki", "Mozilla/5.0");
for (const url of [
  "https://www.nabo.by/recipes/syrniki?utm_source=audit",
  "https://nabo-new.vercel.app/recipes/syrniki",
]) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    report.redirects.push({
      url,
      status: response.status,
      location: response.headers.get("location"),
      platformError: response.headers.get("x-vercel-error"),
    });
  } catch (error) {
    report.redirects.push({ url, error: error.message });
  }
}
for (const url of report.sitemaps) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) }),
      xml = await response.text();
    report.pages.push({
      path: new URL(url).pathname,
      status: response.status,
      urlCount: [...xml.matchAll(/<loc>/g)].length,
      foreignLoc: [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].some(
        (match) => !match[1].startsWith(origin + "/"),
      ),
    });
  } catch (error) {
    report.pages.push({ path: url, error: error.message });
  }
}
console.log(JSON.stringify(report, null, 2));
