import { isSafeArticleMediaUrl, renderArticleHtmlForDisplay } from '../utils/article-html.js';
import { escapeHtml } from '../utils/sanitize.js';
import { formatArticleDate } from '../components/render-articles.js';
import { getArticleBySlug, getPublishedArticles } from '../services/articles-service.js';
import { initMobileMenu, initScrollReveal } from './page-utils.js';
import { logClientError } from '../utils/error-messages.js';

const articleContainer = document.querySelector('#articleContent');
const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');
const FALLBACK_IMAGE = 'assets/images/irrigation.jpg';
const DEFAULT_META_DESCRIPTION = 'Découvrez cet article publié par Agri-tech.';
let currentArticleShareData = null;
let shareToastTimeout = null;

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength = 155) {
  const text = stripHtml(value);
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength - 1).trimEnd();
  const lastSpace = truncated.lastIndexOf(' ');
  return `${(lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated).trimEnd()}…`;
}

function getArticleDescription(article) {
  const content = Array.isArray(article.content) ? article.content.join(' ') : article.content;
  return truncateText(article.excerpt || content || DEFAULT_META_DESCRIPTION);
}

function toAbsoluteUrl(url) {
  try {
    return new URL(url || FALLBACK_IMAGE, window.location.origin).href;
  } catch (error) {
    return new URL(FALLBACK_IMAGE, window.location.origin).href;
  }
}

function setMeta(selector, value) {
  const tag = document.querySelector(selector);
  if (tag && value) tag.setAttribute('content', value);
}

function updateArticleMeta(article) {
  const title = stripHtml(article.title) || 'Agri-tech - Actualités agricoles';
  const description = getArticleDescription(article);
  const coverImage = article.coverImage || article.cover_image_url || '';
  const image = toAbsoluteUrl(isSafeArticleMediaUrl(coverImage) ? coverImage : FALLBACK_IMAGE);
  const url = window.location.href;

  document.title = `${title} | Agri-tech`;
  setMeta('meta[name="description"]', description);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[property="og:image"]', image);
  setMeta('meta[property="og:url"]', url);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', description);
  setMeta('meta[name="twitter:image"]', image);
}

function getShareData(article) {
  return {
    title: stripHtml(article.title) || document.title,
    text: getArticleDescription(article) || DEFAULT_META_DESCRIPTION,
    url: window.location.href
  };
}

function showToast(message) {
  const toast = document.querySelector('#articleShareToast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(shareToastTimeout);
  shareToastTimeout = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2600);
}

async function copyArticleUrl(url) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

async function handleArticleShare() {
  if (!currentArticleShareData) return;

  try {
    if (navigator.share) {
      await navigator.share(currentArticleShareData);
      showToast('Article partagé');
      return;
    }

    await copyArticleUrl(currentArticleShareData.url);
    showToast('Lien copié');
  } catch (error) {
    if (error?.name === 'AbortError') return;

    try {
      await copyArticleUrl(currentArticleShareData.url);
      showToast('Lien copié');
    } catch (copyError) {
      console.error('Partage indisponible:', copyError);
      showToast('Partage indisponible');
    }
  }
}

function renderRelatedArticleCard(article) {
  const category = String(article.category || '').trim();
  const articleUrl = `article.html?slug=${encodeURIComponent(article.slug)}`;

  return `
    <article class="article-card related-article-card reveal">
      <a class="article-card-image" href="${articleUrl}" aria-label="Lire : ${escapeHtml(article.title)}">
        <img src="${escapeHtml(isSafeArticleMediaUrl(article.coverImage) ? article.coverImage : FALLBACK_IMAGE)}" alt="${escapeHtml(article.title)}" width="1200" height="800" loading="lazy" decoding="async" />
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
          <p>Article introuvable ou indisponible.</p>
          <a href="actualites.html" class="article-back-link">← Retour aux actualités</a>
        </section>
      </div>
    </section>
  `;
}

function renderArticle(article, relatedArticles = []) {
  if (!articleContainer) return;

  updateArticleMeta(article);
  currentArticleShareData = getShareData(article);

  const safeArticleBody = renderArticleHtmlForDisplay(article.content);

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
        <div class="article-cover-wrap reveal">
          <img class="article-cover" src="${escapeHtml(isSafeArticleMediaUrl(article.coverImage) ? article.coverImage : FALLBACK_IMAGE)}" alt="${escapeHtml(article.title)}" width="1200" height="800" decoding="async" />
          <button class="article-share-button" type="button" aria-label="Partager cet article" title="Partager cet article">
            <span class="share-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false"><path d="M18 16.1c-.8 0-1.5.3-2 .8L8.9 12.7a3.3 3.3 0 0 0 0-1.4L16 7.1A3 3 0 1 0 15 5l-7.1 4.2a3 3 0 1 0 0 5.6L15 19a3 3 0 1 0 3-2.9Z"/></svg>
            </span>
            <span>Partager</span>
          </button>
          <span class="article-share-toast" id="articleShareToast" role="status" aria-live="polite" aria-atomic="true"></span>
        </div>
        <div class="article-content reveal">
          ${safeArticleBody}
        </div>
      </section>
      ${renderRelatedSection(relatedArticles, article.slug)}
    </article>
  `;

  articleContainer.querySelector('.article-share-button')?.addEventListener('click', handleArticleShare);
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
        console.warn('[Agri-tech article] Actualités liées indisponibles:', relatedError?.message || relatedError);
      }
      renderArticle(article, relatedArticles);
    }
  } catch (error) {
    logClientError('article', error);
    renderNotFound();
  }

  initScrollReveal();
});
