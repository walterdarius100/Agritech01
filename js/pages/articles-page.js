import { getPublishedArticles, renderArticleCards } from '../components/render-articles.js';
import { escapeHtml } from '../utils/sanitize.js';
import { initMobileMenu, initScrollReveal } from './page-utils.js';

const grid = document.querySelector('#articlesGrid');
const filters = document.querySelector('#articleFilters');
let publishedArticles = [];

function renderFilters() {
  if (!filters) return;
  const categories = ['Tous', ...new Set(publishedArticles.map((article) => article.category))];
  filters.innerHTML = categories
    .map((category, index) => `<button class="filter-btn ${index === 0 ? 'active' : ''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
    .join('');
}

function renderList(category = 'Tous') {
  const visibleArticles = category === 'Tous'
    ? publishedArticles
    : publishedArticles.filter((article) => article.category === category);

  renderArticleCards({ container: grid, articles: visibleArticles });
  initScrollReveal(grid?.querySelectorAll('.reveal'));
}

function setupFilters() {
  if (!filters) return;
  filters.addEventListener('click', (event) => {
    const button = event.target.closest('.filter-btn');
    if (!button) return;

    filters.querySelectorAll('.filter-btn').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    renderList(button.dataset.category);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initMobileMenu();

  try {
    publishedArticles = await getPublishedArticles();
    renderFilters();
    renderList();
    setupFilters();
  } catch (error) {
    console.error('Erreur actualités:', error);
    renderArticleCards({ container: grid, articles: [], emptyMessage: 'Les actualités sont indisponibles pour le moment.' });
  }

  initScrollReveal();
});
