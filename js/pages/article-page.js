import { escapeHtml } from '../utils/sanitize.js';
import { sanitizeArticleHtml } from '../utils/article-html.js';
import { formatArticleDate } from '../components/render-articles.js';
import { getArticleBySlug, getPublishedArticles } from '../services/articles-service.js';
import { initMobileMenu, initScrollReveal } from './page-utils.js';
import { logClientError } from '../utils/error-messages.js';

const articleContainer = document.querySelector('#articleContent');
const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');
const FALLBACK_IMAGE = 'assets/images/irrigation.jpg';
const DEFAULT_META_DESCRIPTION = 'Découvrez cet article publié par Agri-tech.';
const OFFICIAL_SITE_ORIGIN = 'https://agritech509ht.com';
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
    return new URL(url || FALLBACK_IMAGE, OFFICIAL_SITE_ORIGIN).href;
  } catch (error) {
    return new URL(FALLBACK_IMAGE, OFFICIAL_SITE_ORIGIN).href;
  }
}

function getOfficialArticleUrl(articleSlug = slug) {
  const url = new URL('article.html', OFFICIAL_SITE_ORIGIN);
  if (articleSlug) url.searchParams.set('slug', articleSlug);
  return url.href;
}

function setCanonical(url) {
  const tag = document.querySelector('link[rel="canonical"]');
  if (tag && url) tag.setAttribute('href', url);
}

function setMeta(selector, value) {
  const tag = document.querySelector(selector);
  if (tag && value) tag.setAttribute('content', value);
}

function updateArticleMeta(article) {
  const title = stripHtml(article.title) || 'Agri-tech - Actualités agricoles';
  const description = getArticleDescription(article);
  const image = toAbsoluteUrl(article.coverImage || article.cover_image_url || FALLBACK_IMAGE);
  const url = getOfficialArticleUrl(article.slug);

  document.title = `${title} | Agri-tech`;
  setMeta('meta[name="description"]', description);
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[property="og:image"]', image);
  setMeta('meta[property="og:url"]', url);
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', description);
  setMeta('meta[name="twitter:image"]', image);
  setCanonical(url);
}

function getShareData(article) {
  return {
    title: stripHtml(article.title) || document.title,
    text: getArticleDescription(article) || DEFAULT_META_DESCRIPTION,
    url: getOfficialArticleUrl(article.slug)
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


function renderShareIcon(platform) {
  const icons = {
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 12a10 10 0 1 0-11.5 9.9v-7h-2.7v-2.9h2.7V9.8c0-2.7 1.6-4.2 4-4.2 1.2 0 2.4.2 2.4.2v2.6h-1.3c-1.3 0-1.7.8-1.7 1.6v1.9h2.9l-.5 2.9h-2.4v7A10 10 0 0 0 22 12"/></svg>',
    linkedin: '<svg class="share-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.32 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.1 20.45H3.53V9H7.1v11.45ZM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.72V1.72C24 .77 23.21 0 22.23 0Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 3.5A11 11 0 0 0 3.7 17.8L2 22l4.4-1.6A11 11 0 1 0 20.5 3.5Zm-8.6 16a8.9 8.9 0 0 1-4.5-1.2l-.3-.2-2.6.9.9-2.5-.2-.3A8.9 8.9 0 1 1 11.9 19.5Zm4.9-6.7c-.3-.2-1.7-.8-2-.9s-.5-.2-.7.2-.8.9-1 .1a7.3 7.3 0 0 1-2.2-2.7c-.2-.4 0-.6.2-.8l.3-.3c.1-.1.2-.2.3-.4s0-.4 0-.6-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.2 3.2 0 0 0-1 2.4 5.6 5.6 0 0 0 1.2 3c.2.3 2.1 3.2 5 4.5 2.9 1.2 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.3.1-1.4-.1-.1-.3-.2-.6-.4Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18.2 2.3h3.3l-7.2 8.2 8.5 11.2h-6.7l-5.2-6.8-6 6.8H1.7l7.7-8.8L1.3 2.3h6.8l4.7 6.2 5.4-6.2Zm-1.2 17.5h1.8L7.1 4.1h-2L17 19.8Z"/></svg>',
    email: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm8 8 8-5V7l-8 5-8-5v1l8 5Z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 7a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-1v1a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h1V7Zm3-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-7Zm-3 4H7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-1h-4a3 3 0 0 1-3-3v-4Z"/></svg>'
  };

  return icons[platform] || '';
}

function getArticleShareLinks(article) {
  const articleUrl = getOfficialArticleUrl(article.slug);
  const articleTitle = stripHtml(article.title) || document.title;
  const encodedUrl = encodeURIComponent(articleUrl);
  const encodedTitle = encodeURIComponent(articleTitle);

  return [
    {
      platform: 'facebook',
      label: 'Partager sur Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      external: true
    },
    {
      platform: 'linkedin',
      label: 'Partager sur LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      external: true
    },
    {
      platform: 'whatsapp',
      label: 'Partager sur WhatsApp',
      href: `https://wa.me/?text=${encodeURIComponent(`${articleTitle} ${articleUrl}`)}`,
      external: true
    },
    {
      platform: 'x',
      label: 'Partager sur X',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      external: true
    },
    {
      platform: 'email',
      label: 'Partager par email',
      href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
      external: false
    }
  ];
}

function renderArticleShareSection(article) {
  const shareLinks = getArticleShareLinks(article);

  return `
    <section class="article-share-section reveal" aria-label="Partager cet article">
      <p>Vous avez aimé cet article ? Partagez-le avec vos proches et vos amis.</p>
      <div class="article-share-list" aria-label="Options de partage de l’article">
        ${shareLinks.map((link) => `
          <a class="article-share-link" data-share-platform="${link.platform}" href="${escapeHtml(link.href)}" aria-label="${escapeHtml(link.label)}"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
            ${renderShareIcon(link.platform)}
          </a>
        `).join('')}
        <button class="article-share-link article-share-copy" type="button" data-share-platform="copy" aria-label="Copier le lien de l’article">
          ${renderShareIcon('copy')}
        </button>
      </div>
      <span class="article-share-copy-status" id="articleShareCopyStatus" role="status" aria-live="polite" aria-atomic="true"></span>
    </section>
  `;
}

function showCopyStatus(message) {
  const status = document.querySelector('#articleShareCopyStatus');
  if (!status) return;

  status.textContent = message;
  window.clearTimeout(shareToastTimeout);
  shareToastTimeout = window.setTimeout(() => {
    status.textContent = '';
  }, 2600);
}

async function handleArticleCopyShare() {
  if (!currentArticleShareData) return;

  try {
    await copyArticleUrl(currentArticleShareData.url);
    showCopyStatus('Lien copié');
  } catch (error) {
    console.error('Copie indisponible:', error);
    showCopyStatus('Copie indisponible');
  }
}

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

  const sanitizedContent = sanitizeArticleHtml(article.content);
  const category = String(article.category || '').trim();
  const excerpt = String(article.excerpt || '').trim();
  const author = String(article.author || 'Agri-tech').trim();

  articleContainer.innerHTML = `
    <article>
      <section class="article-detail-hero">
        <div class="article-detail-hero-inner reveal is-visible">
          <div class="article-detail-meta">
            ${category ? `<span class="article-detail-category">${escapeHtml(category)}</span>` : ''}
            <time class="article-detail-date" datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(formatArticleDate(article.publishedAt))}</time>
          </div>

          <h1 class="article-detail-title">${escapeHtml(article.title)}</h1>

          ${excerpt ? `<p class="article-detail-excerpt">${escapeHtml(excerpt)}</p>` : ''}

          <div class="article-detail-footer">
            <span class="article-detail-author">Par ${escapeHtml(author)}</span>
            <button class="article-detail-share" type="button" aria-label="Partager cet article" title="Partager cet article">
              <span class="share-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false"><path d="M18 16.1c-.8 0-1.5.3-2 .8L8.9 12.7a3.3 3.3 0 0 0 0-1.4L16 7.1A3 3 0 1 0 15 5l-7.1 4.2a3 3 0 1 0 0 5.6L15 19a3 3 0 1 0 3-2.9Z"/></svg>
              </span>
              <span>Partager</span>
            </button>
          </div>
          <span class="article-share-toast" id="articleShareToast" role="status" aria-live="polite" aria-atomic="true"></span>
        </div>
      </section>
      <section class="section-pad article-layout">
        <div class="article-cover-wrap reveal">
          <img class="article-cover" src="${escapeHtml(article.coverImage || FALLBACK_IMAGE)}" alt="${escapeHtml(article.title)}" width="1200" height="800" decoding="async" />
        </div>
        <div class="article-content rich-content is-visible">
          ${sanitizedContent}
        </div>
        ${renderArticleShareSection(article)}
      </section>
      ${renderRelatedSection(relatedArticles, article.slug)}
    </article>
  `;

  articleContainer.querySelector('.article-detail-share')?.addEventListener('click', handleArticleShare);
  articleContainer.querySelector('.article-share-copy')?.addEventListener('click', handleArticleCopyShare);
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
