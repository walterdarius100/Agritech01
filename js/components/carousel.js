// Shared carousel helpers can be extended by future pages.
export function clampCarouselIndex(index, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(index, total - 1));
}
