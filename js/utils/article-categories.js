export const ARTICLE_CATEGORIES = Object.freeze([
  'Actualités et analyses',
  'Production végétale',
  'Production animale'
]);

export function normalizeCategory(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const officialCategories = new Map(ARTICLE_CATEGORIES.map((label) => [normalizeCategory(label), label]));

export function getOfficialCategory(value) {
  return officialCategories.get(normalizeCategory(value));
}
