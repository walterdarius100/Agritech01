import { getFeaturedArticle, getPublishedArticles } from '../services/articles-service.js';
export { getFeaturedArticle, getPublishedArticles };
import { escapeHtml } from '../utils/sanitize.js';
import { getDelayClass } from '../utils/validation.js';

export function formatArticleDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date non renseignée';

  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date);
}

function getArticleUrl(article) {
  return `article.html?slug=${encodeURIComponent(article?.slug || '')}`;
}

function getArticleImage(article) {
  return article?.coverImage || 'assets/images/logo-agritech.png';
}

export function renderFeaturedArticle({ container, article }) {
  if (!container) return;

  if (!article) {
    container.innerHTML = '<p class="empty-state">Aucun article à la une pour le moment.</p>';
    return;
  }

  container.innerHTML = `
    <article class="featured-article reveal is-visible">
      <a class="featured-article-image" href="${getArticleUrl(article)}" aria-label="Lire : ${escapeHtml(article.title)}">
        <img src="${escapeHtml(getArticleImage(article))}" alt="${escapeHtml(article.title)}" width="1200" height="800" loading="lazy" decoding="async" />
      </a>
      <div class="featured-article-body">
        <div class="article-meta">
          <span class="tag">${escapeHtml(article.category)}</span>
          <time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatArticleDate(article.publishedAt))}</time>
        </div>
        <h3><a href="${getArticleUrl(article)}">${escapeHtml(article.title)}</a></h3>
        <p>${escapeHtml(article.excerpt)}</p>
        <a href="${getArticleUrl(article)}" class="btn primary">Lire l’article</a>
      </div>
    </article>
  `;
}

export function renderArticleCards({ container, articles = [], emptyMessage = 'Aucune actualité publiée pour le moment.' }) {
  if (!container) return;

  if (!articles.length) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  container.innerHTML = articles
    .map((article, index) => `
      <article class="article-card reveal ${getDelayClass(index)}">
        <a class="article-card-image" href="${getArticleUrl(article)}" aria-label="Lire : ${escapeHtml(article.title)}">
          <img src="${escapeHtml(getArticleImage(article))}" alt="${escapeHtml(article.title)}" width="1200" height="800" loading="lazy" decoding="async" />
        </a>
        <div class="article-card-body">
          <div class="article-meta">
            <span class="tag">${escapeHtml(article.category)}</span>
            <time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatArticleDate(article.publishedAt))}</time>
          </div>
          <h3><a href="${getArticleUrl(article)}">${escapeHtml(article.title)}</a></h3>
          <p>${escapeHtml(article.excerpt)}</p>
          <a href="${getArticleUrl(article)}" class="card-link">Lire l’article →</a>
        </div>
      </article>
    `)
    .join('');
}
