import { escapeHtml } from '../utils/sanitize.js';
import { formatArticleDate } from '../components/render-articles.js';
import { getPublishedArticleBySlug } from '../services/articles-service.js';
import { initMobileMenu, initScrollReveal } from './page-utils.js';

const articleContainer = document.querySelector('#articleContent');
const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');

function renderNotFound(message = 'L’article demandé n’existe pas ou n’est plus disponible.') {
  if (!articleContainer) return;
  document.title = 'Article introuvable | Agri-tech';
  articleContainer.innerHTML = `
    <section class="section-pad legal-layout">
      <div class="legal-card reveal is-visible">
        <section class="legal-section">
          <span class="eyebrow">Actualités</span>
          <h1>Article introuvable</h1>
          <p>${escapeHtml(message)}</p>
          <a href="actualites.html" class="article-back-link">← Retour aux actualités</a>
        </section>
      </div>
    </section>
  `;
}

function renderTextContent(content) {
  const blocks = String(content || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (!blocks.length) return '<p>Contenu à venir.</p>';

  return blocks.map((block) => {
    if (/^#{2,3}\s+/.test(block)) {
      const level = block.startsWith('###') ? 'h3' : 'h2';
      return `<${level}>${escapeHtml(block.replace(/^#{2,3}\s+/, ''))}</${level}>`;
    }

    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length && lines.every((line) => /^[-*]\s+/.test(line))) {
      return `<ul>${lines.map((line) => `<li>${escapeHtml(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`;
    }

    return `<p>${escapeHtml(block).replaceAll('\n', '<br>')}</p>`;
  }).join('');
}

function renderArticle(article) {
  if (!articleContainer) return;

  document.title = `${article.title} | Agri-tech`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) metaDescription.setAttribute('content', article.excerpt || article.title);

  const coverImage = article.coverImage || article.cover_image_url || 'assets/images/pepiniere.jpg';

  articleContainer.innerHTML = `
    <article>
      <section class="hero page-hero legal-hero article-hero section-pad">
        <div class="reveal is-visible">
          <span class="eyebrow">${escapeHtml(article.category)}</span>
          <h1>${escapeHtml(article.title)}</h1>
          ${article.excerpt ? `<p>${escapeHtml(article.excerpt)}</p>` : ''}
          <div class="article-byline">
            <span>${escapeHtml(article.author || 'Agri-tech')}</span>
            <time datetime="${escapeHtml(article.publishedAt || '')}">${escapeHtml(formatArticleDate(article.publishedAt || new Date()))}</time>
          </div>
        </div>
      </section>
      <section class="section-pad article-layout">
        <img class="article-cover reveal" src="${escapeHtml(coverImage)}" alt="${escapeHtml(article.title)}" width="1200" height="800" decoding="async" />
        <div class="article-content reveal">
          ${renderTextContent(article.content)}
        </div>
        <a href="actualites.html" class="article-back-link reveal">← Retour aux actualités</a>
      </section>
    </article>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  initMobileMenu();

  if (!slug) {
    renderNotFound('Aucun slug d’article n’a été fourni.');
    initScrollReveal();
    return;
  }

  try {
    const article = await getPublishedArticleBySlug(slug);
    if (!article) {
      renderNotFound();
    } else {
      renderArticle(article);
    }
  } catch (error) {
    renderNotFound('Les actualités sont temporairement indisponibles.');
  }

  initScrollReveal();
});
