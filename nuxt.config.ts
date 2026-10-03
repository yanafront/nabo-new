export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: false },
  css: ["leaflet/dist/leaflet.css", "~/assets/css/design-system.css"],
  runtimeConfig: {
    retailApiBase: "https://naboback-production.up.railway.app",
    geocoderBase: "https://photon.komoot.io",
    yandexGeocoderApiKey: "",
    public: { yandexMapsApiKey: "" },
  },
  app: {
    head: {
      title: "Nabo — что сегодня приготовим?",
      htmlAttrs: { lang: "ru" },
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
