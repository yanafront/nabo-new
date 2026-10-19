import {
  siteOrigin,
  seoPolicy,
  jsonLd,
  indexableHost,
} from "~/shared/seo/core";
export interface PageSeo {
  title: string;
  description: string;
  image?: string;
  schemas?: Record<string, unknown>[];
  noindex?: boolean;
}
export function usePageSeo(input: MaybeRefOrGetter<PageSeo>) {
  const route = useRoute(),
    config = useRuntimeConfig();
  const origin = siteOrigin(config.public.siteUrl);
  const indexable = indexableHost(
    useRequestURL().hostname,
    config.public.seoIndexable,
  );
  const data = computed(() => toValue(input));
  if (import.meta.server && data.value.noindex)
    useResponseHeader("X-Robots-Tag").value = "noindex, follow";
  const policy = computed(() => seoPolicy(route.path, route.query));
  const canonical = computed(() => origin + policy.value.canonicalPath);
  useSeoMeta({
    title: () => data.value.title,
    description: () => data.value.description,
    robots: () =>
      !indexable || !policy.value.index || data.value.noindex
        ? "noindex,follow"
        : "index,follow,max-image-preview:large",
    ogTitle: () => data.value.title,
    ogDescription: () => data.value.description,
    ogUrl: () => canonical.value,
    ogType: "website",
    ogSiteName: "Nabo",
    ogLocale: "ru_BY",
    ogImage: () => new URL(data.value.image || "/og/nabo.png", origin).href,
    twitterCard: "summary_large_image",
    twitterTitle: () => data.value.title,
    twitterDescription: () => data.value.description,
    twitterImage: () =>
      new URL(data.value.image || "/og/nabo.png", origin).href,
  });
  useHead(() => ({
    link: [{ key: "canonical", rel: "canonical", href: canonical.value }],
    script: [
      {
        key: "seo-schema",
        type: "application/ld+json",
        innerHTML: jsonLd({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": origin + "/#organization",
              name: "Nabo",
              url: origin,
              logo: origin + "/brand/nabo-logo-small.webp",
            },
            {
              "@type": "WebSite",
              "@id": origin + "/#website",
              url: origin,
              name: "Nabo",
              inLanguage: "ru-BY",
              publisher: { "@id": origin + "/#organization" },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: origin + "/recipes?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "WebPage",
              "@id": canonical.value + "#webpage",
              url: canonical.value,
              name: data.value.title,
              description: data.value.description,
              inLanguage: "ru-BY",
              isPartOf: { "@id": origin + "/#website" },
              ...(data.value.image
                ? { primaryImageOfPage: new URL(data.value.image, origin).href }
                : {}),
            },
            ...(data.value.schemas || []),
          ],
        }),
      },
    ],
  }));
}
