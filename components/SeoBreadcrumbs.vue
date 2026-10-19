<script setup lang="ts">
import { breadcrumb, PRIMARY_SITE_ORIGIN } from "~/shared/seo/core";
const props = defineProps<{ entries: Array<{ name: string; path: string }> }>();
useHead(() => ({
  script: [
    {
      key: "breadcrumbs",
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        ...breadcrumb(PRIMARY_SITE_ORIGIN, props.entries),
      }).replace(/</g, "\\u003c"),
    },
  ],
}));
</script>
<template>
  <nav class="seo-breadcrumbs" aria-label="Хлебные крошки">
    <ol>
      <li v-for="(entry, index) in entries" :key="entry.path">
        <NuxtLink v-if="index < entries.length - 1" :to="entry.path">{{
          entry.name
        }}</NuxtLink
        ><span v-else aria-current="page">{{ entry.name }}</span>
      </li>
    </ol>
  </nav>
</template>
<style scoped>
.seo-breadcrumbs {
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 12px;
}
.seo-breadcrumbs ol {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  padding: 0;
  margin: 0;
}
.seo-breadcrumbs li + li:before {
  content: "/";
  padding-right: 6px;
}
.seo-breadcrumbs a {
  color: inherit;
}
</style>
