import { outboundUrl } from "~/shared/outbound-url";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("app:mounted", () => {
    const tag = (link: HTMLAnchorElement) => {
      const href = link.getAttribute("href");
      if (!href) return;
      const tagged = outboundUrl(href, window.location.origin);
      if (tagged !== href) link.setAttribute("href", tagged);
    };
    const scan = (node: Node) => {
      if (!(node instanceof Element)) return;
      if (node instanceof HTMLAnchorElement) tag(node);
      node.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(tag);
    };
    scan(document.body);
    // Covers asynchronously loaded products, dialogs, and map attribution links.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (
          record.type === "attributes" &&
          record.target instanceof HTMLAnchorElement
        )
          tag(record.target);
        else record.addedNodes.forEach(scan);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    });
    // Refresh the URL before normal, Ctrl/Cmd, or middle-button navigation.
    const beforeNavigation = (event: MouseEvent) => {
      const link = event
        .composedPath()
        .find((node) => node instanceof HTMLAnchorElement);
      if (link instanceof HTMLAnchorElement) tag(link);
    };
    document.addEventListener("click", beforeNavigation, true);
    document.addEventListener("auxclick", beforeNavigation, true);
  });
});
