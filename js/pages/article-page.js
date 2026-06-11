import { escapeHtml } from '../utils/sanitize.js';
import { formatArticleDate } from '../components/render-articles.js';
import { getArticleBySlug } from '../services/articles-service.js';
import { initMobileMenu, initScrollReveal } from './page-utils.js';

const articleContainer = document.querySelector('#articleContent');
const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');

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

function renderArticle(article) {
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
        <img class="article-cover reveal" src="${escapeHtml(article.coverImage || 'assets/images/logo-agritech.png')}" alt="${escapeHtml(article.title)}" width="1200" height="800" decoding="async" />
        <div class="article-content reveal">
          ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
        </div>
        <a href="actualites.html" class="article-back-link reveal">← Retour aux actualités</a>
      </section>
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
      renderArticle(article);
    }
  } catch (error) {
    console.error('Erreur article:', error);
    renderNotFound();
  }

  initScrollReveal();
});
