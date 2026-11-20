import { projects } from '../data/projects.js';
import { escapeHtml } from '../utils/sanitize.js';

export function renderProjects(grid, pendingMessage) {
  if (!grid) return;

  grid.innerHTML = projects.map(({ title, description, image, href }, index) => {
    const sizes = index === 0
      ? '(min-width: 1180px) 440px, (min-width: 901px) 38vw, (min-width: 621px) 60vw, calc(100vw - 32px)'
      : '(min-width: 1180px) 265px, (min-width: 901px) 23vw, (min-width: 621px) 39vw, 48vw';
    const media = image?.src && image.alt
      ? `<img class="home-project-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"
          width="${escapeHtml(image.width)}" height="${escapeHtml(image.height)}"
          ${image.srcset ? `srcset="${escapeHtml(image.srcset)}" sizes="${sizes}"` : ''}
          loading="lazy" decoding="async">`
      : '<div class="home-project-placeholder">Photo à venir</div>';

    return `
      <li class="home-project-card">
        <div class="home-project-media">${media}</div>
        ${title ? `
          <div class="home-project-content">
            <h3>${escapeHtml(title)}</h3>
            ${description ? `<p>${escapeHtml(description)}</p>` : ''}
            ${href ? `<a class="card-link" href="${escapeHtml(href)}" aria-label="En savoir plus sur ${escapeHtml(title)}">En savoir plus</a>` : ''}
          </div>
        ` : ''}
      </li>
    `;
  }).join('');
  if (pendingMessage) pendingMessage.hidden = !grid.querySelector('.home-project-placeholder');
}
