export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: false },
  css: ["leaflet/dist/leaflet.css", "~/assets/css/design-system.css"],
  runtimeConfig: {
    recipesApiBase: "",
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
    public: { yandexMapsApiKey: "" },
  },
  app: {
    head: {
      title: "Nabo — что сегодня приготовим?",
      htmlAttrs: { lang: "ru" },
      link: [
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
      noscript: [
        {
          key: "yandex-metrika",
          tagPosition: "bodyClose",
          innerHTML:
            '<div><img src="https://mc.yandex.ru/watch/113355204" style="position:absolute; left:-9999px;" alt="" /></div>',
        },
      ],
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
