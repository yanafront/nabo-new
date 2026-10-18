export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: false },
  routeRules: { "/compare": { redirect: { to: "/basket", statusCode: 301 } } },
  css: ["~/assets/css/design-system.css"],
  runtimeConfig: {
    recipesApiBase: "",
    seoIngestKey: "",
    diningApiBase: "https://delivio.by",
    recipePhotos: {
      accountId: "",
      accessKeyId: "",
      secretAccessKey: "",
      bucket: "",
      publicBase: "",
    },
    retailApiBase: "https://naboback-production.up.railway.app",
    geocoderBase: "https://photon.komoot.io",
    yandexGeocoderApiKey: "",
    public: {
      siteUrl: "https://www.nabo.by",
      googleSiteVerification: "",
      yandexVerification: "",
      seoIndexable: process.env.VERCEL_ENV !== "preview",
      yandexMapsApiKey: "",
      legal: { operator: "", address: "", email: "", unp: "" },
    },
  },
  app: {
    head: {
      title: "Nabo — что сегодня приготовим?",
      htmlAttrs: { lang: "ru" },
      link: [
        {
          rel: "preload",
          href: "/fonts/InterVariable.woff2",
          as: "font",
          type: "font/woff2",
          crossorigin: "anonymous",
        },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon-32x32.png",
        },
        { rel: "shortcut icon", href: "/favicon.ico" },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
      ],
      viewport:
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      meta: [
        {
          name: "description",
          content:
            "От идеи на ужин до выгодной продуктовой корзины. Сравнивайте магазины вместе с Nabo.",
        },
        { name: "theme-color", content: "#FFFFFF" },
      ],
    },
  },
  typescript: { strict: true },
});
