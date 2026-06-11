import { getFeaturedArticle, getPublishedArticles, renderArticleCards, renderFeaturedArticle } from '../components/render-articles.js';
import { escapeHtml } from '../utils/sanitize.js';
import { initMobileMenu, initScrollReveal } from './page-utils.js';

const ARTICLES_PER_PAGE = 4;
const grid = document.querySelector('#articlesGrid');
const filters = document.querySelector('#articleFilters');
const featuredContainer = document.querySelector('#featuredArticle');
const pagination = document.querySelector('#articlesPagination');
const params = new URLSearchParams(window.location.search);

function getValidPage(value) {
  const page = Number.parseInt(value || '1', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

let publishedArticles = [];
let featuredArticle = null;
let activeCategory = params.get('category') || 'Tous';
let currentPage = getValidPage(params.get('page'));

function getOtherArticles() {
  return publishedArticles.filter((article) => article.slug !== featuredArticle?.slug);
}

function getFilteredArticles() {
  const articles = getOtherArticles();
  if (activeCategory === 'Tous') return articles;
  return articles.filter((article) => article.category === activeCategory);
}

function buildPageUrl(page, category = activeCategory) {
  const nextParams = new URLSearchParams();
  if (page > 1) nextParams.set('page', String(page));
  if (category !== 'Tous') nextParams.set('category', category);
  const query = nextParams.toString();
  return query ? `actualites.html?${query}` : 'actualites.html';
}

function renderFilters() {
  if (!filters) return;
  const categories = ['Tous', ...new Set(publishedArticles.map((article) => article.category))];
  if (!categories.includes(activeCategory)) activeCategory = 'Tous';

  filters.innerHTML = categories
    .map((category) => `<a class="filter-btn ${category === activeCategory ? 'active' : ''}" href="${buildPageUrl(1, category)}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</a>`)
    .join('');
}

function renderPagination(totalPages) {
  if (!pagination) return;
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  const previousLink = currentPage > 1
    ? `<a class="pagination-link" href="${buildPageUrl(currentPage - 1)}">← Précédent</a>`
    : '<span class="pagination-link is-disabled" aria-disabled="true">← Précédent</span>';
  const nextLink = currentPage < totalPages
    ? `<a class="pagination-link" href="${buildPageUrl(currentPage + 1)}">Suivant →</a>`
    : '<span class="pagination-link is-disabled" aria-disabled="true">Suivant →</span>';

  pagination.innerHTML = `
    ${previousLink}
    <span class="pagination-status">Page ${currentPage} / ${totalPages}</span>
    ${nextLink}
  `;
}

function renderList() {
  const visibleArticles = getFilteredArticles();
  const totalPages = Math.max(Math.ceil(visibleArticles.length / ARTICLES_PER_PAGE), 1);
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * ARTICLES_PER_PAGE;
  const pageArticles = visibleArticles.slice(start, start + ARTICLES_PER_PAGE);

  renderArticleCards({ container: grid, articles: pageArticles, emptyMessage: 'Aucune autre actualité publiée dans cette catégorie.' });
  renderPagination(totalPages);
  initScrollReveal(grid?.querySelectorAll('.reveal'));
}

function setupFilters() {
  if (!filters) return;
  filters.addEventListener('click', (event) => {
    const link = event.target.closest('.filter-btn');
    if (!link) return;

    event.preventDefault();
    activeCategory = link.dataset.category || 'Tous';
    currentPage = 1;
    window.history.pushState({}, '', buildPageUrl(currentPage, activeCategory));
    renderFilters();
    renderList();
  });
}

window.addEventListener('popstate', () => {
  const nextParams = new URLSearchParams(window.location.search);
  activeCategory = nextParams.get('category') || 'Tous';
  currentPage = getValidPage(nextParams.get('page'));
  renderFilters();
  renderList();
});

document.addEventListener('DOMContentLoaded', async () => {
  initMobileMenu();

  try {
    publishedArticles = await getPublishedArticles();
    featuredArticle = getFeaturedArticle(publishedArticles);
    renderFeaturedArticle({ container: featuredContainer, article: featuredArticle });
    renderFilters();
    renderList();
    setupFilters();
  } catch (error) {
    console.error('Erreur actualités:', error);
    renderArticleCards({ container: grid, articles: [], emptyMessage: 'Les actualités sont indisponibles pour le moment.' });
  }

  initScrollReveal();
});
