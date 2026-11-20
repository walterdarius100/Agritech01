import { projects } from '../data/projects.js';
import { escapeHtml } from '../utils/sanitize.js';

export function renderProjects(grid) {
  if (!grid) return;

  grid.innerHTML = projects.map(({ title, description, image, href }) => {
    if (!title || !image?.src || !image.alt) {
      return `
        <li class="home-project-card">
          <div class="home-project-placeholder">Photo à venir</div>
        </li>
      `;
    }

    return `
      <li class="home-project-card">
        <img class="home-project-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"
          width="${escapeHtml(image.width)}" height="${escapeHtml(image.height)}"
          ${image.srcset ? `srcset="${escapeHtml(image.srcset)}" sizes="(min-width: 1180px) 365px, (min-width: 621px) 31vw, calc(100vw - 32px)"` : ''}
          loading="lazy" decoding="async">
        <div class="home-project-content">
          <h3>${escapeHtml(title)}</h3>
          ${description ? `<p>${escapeHtml(description)}</p>` : ''}
          ${href ? `<a class="card-link" href="${escapeHtml(href)}" aria-label="En savoir plus sur ${escapeHtml(title)}">En savoir plus</a>` : ''}
        </div>
      </li>
    `;
  }).join('');
}
