import { removeResponseHeader, setResponseHeaders } from "h3";

// Set defaults before handlers; streamed responses and error renderers can bypass beforeResponse.
export default defineNitroPlugin((nitro) => {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "geolocation=(self), microphone=(self), camera=(), payment=(), usb=()",
    "Content-Security-Policy": [
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      // Nuxt's inline payload/bootstrap needs inline scripts. No unsafe-eval.
      "script-src 'self' 'unsafe-inline' https://mc.yandex.ru https://mc.yandex.com https://www.googletagmanager.com https://api-maps.yandex.ru https://*.maps.yandex.net https://yastatic.net",
      "script-src-attr 'none'",
      "font-src 'self' data: https://yastatic.net",
      "frame-src 'self' https://mc.yandex.ru https://mc.yandex.com https://yandex.ru https://yandex.by",
      "upgrade-insecure-requests",
    ].join("; "),
  };
  nitro.hooks.hook("request", (event) => setResponseHeaders(event, headers));
  nitro.hooks.hook("beforeResponse", (event) => {
    removeResponseHeader(event, "x-powered-by");
    setResponseHeaders(event, headers);
  });
  nitro.hooks.hook("render:response", (response) => {
    response.headers ||= {};
    for (const key of Object.keys(response.headers))
      if (key.toLowerCase() === "x-powered-by") delete response.headers[key];
    Object.assign(response.headers, headers);
  });
});
