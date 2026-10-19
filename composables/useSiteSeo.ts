export function useSiteSeo() {
  const route = useRoute();
  const config = useRuntimeConfig();
  useHead(() => ({
    meta: [
      ...(config.public.googleSiteVerification
        ? [
            {
              name: "google-site-verification",
              content: config.public.googleSiteVerification,
            },
          ]
        : []),
      ...(config.public.yandexVerification
        ? [
            {
              name: "yandex-verification",
              content: config.public.yandexVerification,
            },
          ]
        : []),
    ],
  }));
  const pages: Record<string, [string, string]> = {
    "/": [
      "Nabo — что приготовить, где купить продукты или заказать еду",
      "Сравнивайте продукты и цены в магазинах, собирайте корзину по рецепту и смотрите, что выгоднее или удобнее: приготовить дома или заказать готовое блюдо.",
    ],
    "/products": [
      "Продукты и цены в магазинах Беларуси — Nabo",
      "Найдите нужные продукты, сравните предложения магазинов Беларуси и соберите корзину.",
    ],
    "/recipes": [
      "Рецепты с ингредиентами и КБЖУ — Nabo",
      "Рецепты привычных блюд с пошаговым приготовлением, ингредиентами и КБЖУ. Соберите продукты или найдите готовое блюдо с доставкой.",
    ],
    "/stores": [
      "Продуктовые магазины Беларуси — Nabo",
      "Каталоги Евроопта, Green, Гиппо, Соседей, Белмаркета и Санты: продукты, цены и сравнение корзины.",
    ],
    "/delivery": [
      "Готовые блюда с доставкой — Nabo",
      "Посмотрите предложения готовых блюд в заведениях и сравните их с вариантом приготовления дома.",
    ],
  };
  usePageSeo(() => ({
    title:
      (pages[route.path]?.[0] && Number(route.query.page) > 1
        ? `${pages[route.path]![0]} — страница ${route.query.page}`
        : pages[route.path]?.[0]) || "Nabo — продукты и рецепты",
    description:
      pages[route.path]?.[1] ||
      "Nabo: рецепты, подбор продуктов и сравнение магазинов Беларуси.",
  }));
}
