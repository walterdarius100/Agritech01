import { escapeHtml } from '../utils/sanitize.js';
import { getDelayClass } from '../utils/validation.js';

export function renderServices({ serviceGrid, services, setupScrollReveal }) {
  if (!serviceGrid) return;

  serviceGrid.classList.toggle('has-bento-layout', services.length === 3);

  serviceGrid.innerHTML = services
    .map((service, index) => `
      <article class="service-card reveal ${getDelayClass(index)}">
        <img src="${escapeHtml(service.homeImage ? `${service.homeImage}-480.webp` : service.image)}"
          ${service.homeImage ? `srcset="${escapeHtml(service.homeImage)}-480.webp 480w, ${escapeHtml(service.homeImage)}-960.webp 960w"
          sizes="${services.length === 3 && index > 0 ? '(min-width: 901px) 180px, (min-width: 621px) 48vw, calc(100vw - 32px)' : '(min-width: 1180px) 640px, (min-width: 901px) 55vw, calc(100vw - 32px)'}"` : ''} alt="${escapeHtml(service.title)}" class="service-image" width="1200" height="800" loading="lazy" decoding="async" />
        <div class="service-content">
          <span class="tag">${escapeHtml(service.category)}</span>
          <h3>${escapeHtml(service.title)}</h3>
          <p>${escapeHtml(service.text)}</p>
          <a href="#leadForm" data-need="${escapeHtml(service.title)}" class="card-link">Demander ce service →</a>
        </div>
      </article>
    `)
    .join('');

  setupScrollReveal?.(serviceGrid.querySelectorAll('.reveal'));
}
