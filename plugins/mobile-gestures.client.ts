export default defineNuxtPlugin(() => {
  if (!window.matchMedia("(pointer: coarse)").matches) return;
  // Safari gesture events complement touch-action without blocking one-finger scrolling.
  const preventZoom = (event: Event) => event.preventDefault();
  document.addEventListener("gesturestart", preventZoom, { passive: false });
  document.addEventListener("gesturechange", preventZoom, { passive: false });
});
