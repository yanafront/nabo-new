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
      "Nabo — поиск продуктов и сравнение цен в магазинах Беларуси",
      "Найдите продукты в магазинах Беларуси, сравните цены и соберите корзину. Выбирайте товары сами или добавляйте ингредиенты из рецепта. Покупка — на сайте магазина.",
    ],
    "/products": [
      "Поиск продуктов и товаров в магазинах Беларуси — Nabo",
      "Где купить продукты: поиск товаров в Евроопте, Green, Гиппо, Соседях, Белмаркете и Санте. Сравните цены и наличие, соберите корзину и перейдите к покупке.",
    ],
    "/recipes": [
      "Рецепты с ингредиентами и КБЖУ — Nabo",
      "Рецепты привычных блюд с пошаговым приготовлением, ингредиентами и КБЖУ. Соберите продукты или найдите готовое блюдо с доставкой.",
    ],
    "/stores": [
      "Продуктовые магазины рядом: карта и каталоги — Nabo",
      "Найдите продуктовые магазины рядом с выбранной точкой на Яндекс Картах. Каталоги Евроопта, Green, Гиппо, Соседей, Белмаркета и Санты — в одном месте.",
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
