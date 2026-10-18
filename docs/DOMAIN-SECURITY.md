# Основной домен и защита

Основной адрес: https://www.nabo.by. В Vercel Production задайте `NUXT_PUBLIC_SITE_URL=https://www.nabo.by` и `NUXT_PUBLIC_SEO_INDEXABLE=true`, затем выполните redeploy. Старые значения с Vercel и nabo.by дополнительно нормализуются в коде.

`nabo.by` перенаправляется 308 на www с сохранением пути и query. Vercel-домены и неизвестные хосты получают noindex в HTML и X-Robots-Tag, robots Disallow и 404 для sitemap. Preview также можно закрыть Vercel Deployment Protection. Основной домен не блокируется.

После деплоя отправьте https://www.nabo.by/sitemap.xml в Google Search Console и Яндекс Вебмастер; индексация и замена старых URL происходят после переобхода.

Все серверные ответы (включая ошибки) получают CSP, DENY, nosniff, no-referrer и Permissions-Policy. Геолокация и микрофон доступны только самому сайту. CSP сохраняет inline bootstrap Nuxt и разрешает установленные счётчики/карты; это базовое усиление, не nonce-based strict CSP. Изображения и соединения не ограничены CSP, поскольку фото рецептов могут использовать внешнее хранилище. HTTPS/HSTS обслуживает Vercel. x-powered-by удаляется перед отправкой.

Image proxy принимает только HTTPS cdn.ime.by с каталогом /UserFiles/images/catalog/Goods/ и расширением png/jpeg/webp, без credentials и нестандартного порта; максимум URL 2048 символов. На фронте нет произвольного fetch URL. Бэкенд дополнительно проверяет CDN, отключает редиректы, ограничивает время, размер и MIME ответа. Изменения backend в этой задаче не требуются.

Проверки: npm test, npm run typecheck, npm run build, npm run test:seo. SEO smoke проверяет основной и Vercel-host, HTML/schema/canonical, robots/sitemap, apex redirect, заголовки у HTML/404/API и отклонение недопустимого proxy URL.
