export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: false },
  css: ["~/assets/css/main.css", "~/assets/css/compact.css"],
  runtimeConfig: {
    retailApiBase: "https://naboback-production.up.railway.app",
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
        { name: "theme-color", content: "#3B5BFF" },
      ],
    },
  },
  typescript: { strict: true },
});
