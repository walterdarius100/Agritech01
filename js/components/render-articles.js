import { getPublishedArticles, splitFeaturedArticle } from '../services/articles-service.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getDelayClass } from '../utils/validation.js';

export { getPublishedArticles };

export function formatArticleDate(value) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(value));
}


export function getFeaturedArticle(articles) {
  return splitFeaturedArticle(articles).featured;
}

export function renderFeaturedArticle({ container, article }) {
  if (!container) return;

  if (!article) {
    container.innerHTML = '<p class="empty-state">Aucun article à la une pour le moment.</p>';
    return;
  }

  container.innerHTML = `
    <article class="featured-article reveal is-visible">
      <a class="featured-article-image" href="article.html?slug=${encodeURIComponent(article.slug)}" aria-label="Lire : ${escapeHtml(article.title)}">
        <img src="${escapeHtml(article.coverImage || 'assets/images/logo-agritech.png')}" alt="${escapeHtml(article.title)}" width="1200" height="800" loading="lazy" decoding="async" />
      </a>
      <div class="featured-article-body">
        <div class="article-meta">
          <span class="tag">${escapeHtml(article.category)}</span>
          <time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatArticleDate(article.publishedAt))}</time>
        </div>
        <h3><a href="article.html?slug=${encodeURIComponent(article.slug)}">${escapeHtml(article.title)}</a></h3>
        <p>${escapeHtml(article.excerpt || '')}</p>
        <a href="article.html?slug=${encodeURIComponent(article.slug)}" class="btn primary">Lire l’article</a>
      </div>
    </article>
  `;
}

export function renderArticleCards({ container, articles, emptyMessage = 'Aucune actualité publiée pour le moment.' }) {
  if (!container) return;

  if (!articles.length) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  container.innerHTML = articles
    .map((article, index) => `
      <article class="article-card reveal ${getDelayClass(index)}">
        <a class="article-card-image" href="article.html?slug=${encodeURIComponent(article.slug)}" aria-label="Lire : ${escapeHtml(article.title)}">
          <img src="${escapeHtml(article.coverImage || 'assets/images/logo-agritech.png')}" alt="${escapeHtml(article.title)}" width="1200" height="800" loading="lazy" decoding="async" />
        </a>
        <div class="article-card-body">
          <div class="article-meta">
            <span class="tag">${escapeHtml(article.category)}</span>
            <time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatArticleDate(article.publishedAt))}</time>
          </div>
          <h3><a href="article.html?slug=${encodeURIComponent(article.slug)}">${escapeHtml(article.title)}</a></h3>
          <p>${escapeHtml(article.excerpt || '')}</p>
          <a href="article.html?slug=${encodeURIComponent(article.slug)}" class="card-link">Lire l’article →</a>
        </div>
      </article>
    `)
    .join('');
}
