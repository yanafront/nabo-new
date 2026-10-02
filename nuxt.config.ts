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
