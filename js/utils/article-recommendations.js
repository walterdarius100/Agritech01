import { getOfficialCategory } from './article-categories.js';

function publicationTime(article) {
  const time = Date.parse(article.published_at ?? article.publishedAt);
  return Number.isFinite(time) ? time : -Infinity;
}

export function getRelatedArticles(articles, current) {
  const category = getOfficialCategory(current.category);
  const rank = (article) => Number(Boolean(category) && getOfficialCategory(article.category) === category);
  const candidates = articles
    .filter((article) => article.status === 'published' && article.slug && article.slug !== current.slug
      && (current.id == null || article.id !== current.id))
    .sort((a, b) => rank(b) - rank(a)
      || publicationTime(b) - publicationTime(a)
      || (a.slug < b.slug ? -1 : Number(a.slug > b.slug)));

  const suggestions = [];
  const ids = new Set();
  const slugs = new Set();
  for (const article of candidates) {
    if (slugs.has(article.slug) || (article.id != null && ids.has(article.id))) continue;
    suggestions.push(article);
    ids.add(article.id);
    slugs.add(article.slug);
    if (suggestions.length === 3) break;
  }
  return suggestions;
}
