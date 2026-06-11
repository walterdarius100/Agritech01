import { escapeHtml } from '../utils/sanitize.js';
import { formatArticleDate } from '../components/render-articles.js';
import { getArticleBySlug, getPublishedArticles } from '../services/articles-service.js';
import { initMobileMenu, initScrollReveal } from './page-utils.js';

const articleContainer = document.querySelector('#articleContent');
const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');
const FALLBACK_IMAGE = 'assets/images/logo-agritech.png';


function renderRelatedArticleCard(article) {
  const category = String(article.category || '').trim();
  const articleUrl = `article.html?slug=${encodeURIComponent(article.slug)}`;

  return `
    <article class="article-card related-article-card reveal">
      <a class="article-card-image" href="${articleUrl}" aria-label="Lire : ${escapeHtml(article.title)}">
        <img src="${escapeHtml(article.coverImage || FALLBACK_IMAGE)}" alt="${escapeHtml(article.title)}" width="1200" height="800" loading="lazy" decoding="async" />
      </a>
      <div class="article-card-body">
        <div class="article-meta">
          ${category ? `<span class="tag">${escapeHtml(category)}</span>` : ''}
          <time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatArticleDate(article.publishedAt))}</time>
        </div>
        <h3><a href="${articleUrl}">${escapeHtml(article.title)}</a></h3>
        ${article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : ''}
        <a href="${articleUrl}" class="card-link">Lire l’article →</a>
      </div>
    </article>
  `;
}

function renderRelatedSection(articles, currentSlug) {
  const relatedArticles = (articles || [])
    .filter((candidate) => candidate.status === 'published' && candidate.slug !== currentSlug)
    .slice(0, 3);

  if (!relatedArticles.length) return '';

  return `
    <section class="section-pad article-related-section reveal" aria-labelledby="relatedArticlesTitle">
      <div class="article-related-header">
        <div>
          <span class="eyebrow">À lire aussi</span>
          <h2 id="relatedArticlesTitle">Dernières actualités</h2>
        </div>
        <a href="actualites.html" class="article-all-news-link">Voir toutes les actualités →</a>
      </div>
      <div class="article-grid article-related-grid">
        ${relatedArticles.map(renderRelatedArticleCard).join('')}
      </div>
    </section>
  `;
}

function renderNotFound() {
  if (!articleContainer) return;
  document.title = 'Article introuvable | Agri-tech';
  articleContainer.innerHTML = `
    <section class="section-pad legal-layout">
      <div class="legal-card reveal is-visible">
        <section class="legal-section">
          <span class="eyebrow">Actualités</span>
          <h1>Article introuvable</h1>
          <p>L’article demandé n’existe pas ou n’est plus disponible.</p>
          <a href="actualites.html" class="article-back-link">← Retour aux actualités</a>
        </section>
      </div>
    </section>
  `;
}

function renderArticle(article, relatedArticles = []) {
  if (!articleContainer) return;

  document.title = `${article.title} | Agri-tech`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.setAttribute('content', article.excerpt);

  const paragraphs = Array.isArray(article.content) ? article.content : String(article.content || '').split(/\n{2,}/).filter(Boolean);

  articleContainer.innerHTML = `
    <article>
      <section class="hero page-hero legal-hero article-hero section-pad">
        <div class="reveal is-visible">
          <span class="eyebrow">${escapeHtml(article.category)}</span>
          <h1>${escapeHtml(article.title)}</h1>
          <p>${escapeHtml(article.excerpt)}</p>
          <div class="article-byline">
            <span>${escapeHtml(article.author)}</span>
            <time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatArticleDate(article.publishedAt))}</time>
          </div>
        </div>
      </section>
      <section class="section-pad article-layout">
        <img class="article-cover reveal" src="${escapeHtml(article.coverImage || FALLBACK_IMAGE)}" alt="${escapeHtml(article.title)}" width="1200" height="800" decoding="async" />
        <div class="article-content reveal">
          ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
        </div>
        <div class="article-end reveal" aria-label="Fin de l’article">
          <span class="article-end-line" aria-hidden="true"></span>
          <a href="index.html" class="article-back-link article-home-link">← Retour au site Agri-tech</a>
        </div>
      </section>
      ${renderRelatedSection(relatedArticles, article.slug)}
    </article>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  initMobileMenu();

  if (!slug) {
    renderNotFound();
    initScrollReveal();
    return;
  }

  try {
    const article = await getArticleBySlug(slug);

    if (!article) {
      renderNotFound();
    } else {
      let relatedArticles = [];
      try {
        relatedArticles = await getPublishedArticles();
      } catch (relatedError) {
        console.warn('Actualités liées indisponibles:', relatedError);
      }
      renderArticle(article, relatedArticles);
    }
  } catch (error) {
    console.error('Erreur article:', error);
    renderNotFound();
  }

  initScrollReveal();
});
