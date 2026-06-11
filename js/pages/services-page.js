import { services } from '../data/services.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getDelayClass } from '../utils/validation.js';
import { buildContactUrl, initMobileMenu, initScrollReveal } from './page-utils.js';

const categories = ['Tous', ...new Set(services.map((service) => service.category))];
const filters = document.querySelector('#servicePageFilters');
const grid = document.querySelector('#servicePageGrid');

function renderFilters() {
  if (!filters) return;
  filters.innerHTML = categories
    .map((category, index) => `<button class="filter-btn ${index === 0 ? 'active' : ''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
    .join('');
}

function renderServices(category = 'Tous') {
  if (!grid) return;
  const visibleServices = category === 'Tous' ? services : services.filter((service) => service.category === category);

  grid.innerHTML = visibleServices.map((service, index) => `
    <article class="detail-card service-detail-card reveal ${getDelayClass(index)}">
      <img src="${escapeHtml(service.image)}" alt="${escapeHtml(service.title)}" width="1200" height="800" loading="lazy" decoding="async" />
      <div class="detail-card-body">
        <span class="tag">${escapeHtml(service.category)}</span>
        <h3>${escapeHtml(service.title)}</h3>
        <p>${escapeHtml(service.text)}</p>
        <ul class="check-list">
          ${(service.details || []).map((detail) => `<li>${escapeHtml(detail)}</li>`).join('')}
        </ul>
        <p class="detail-note"><strong>Idéal pour :</strong> ${escapeHtml(service.idealFor || 'Porteurs de projets agricoles.')}</p>
        <a class="btn primary full" href="${buildContactUrl(service.title)}">Demander ce service</a>
      </div>
    </article>
  `).join('');

  initScrollReveal(grid.querySelectorAll('.reveal'));
}

function setupFilters() {
  if (!filters) return;
  filters.addEventListener('click', (event) => {
    const button = event.target.closest('.filter-btn');
    if (!button) return;

    filters.querySelectorAll('.filter-btn').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    renderServices(button.dataset.category);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  renderFilters();
  renderServices();
  setupFilters();
  initScrollReveal();
});
