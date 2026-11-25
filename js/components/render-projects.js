import { listPublishedProjects, projectHref, selectHomeProjectPhotos, signProjectPhotos } from '../services/projects-service.js';
import { escapeHtml } from '../utils/sanitize.js';

export function projectPhotoMarkup(src, alt, className = '', loading = 'lazy', placeholder = 'Photo à venir') {
  return `<div class="project-photo">
    <div class="home-project-placeholder"${src ? ' hidden' : ''}${placeholder ? '' : ' aria-hidden="true"'}>${escapeHtml(placeholder)}</div>
    ${src ? `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"
      loading="${loading}" decoding="async">` : ''}
  </div>`;
}

export function handleUnavailableProjectPhotos(container, onUnavailable) {
  const showPlaceholder = image => {
    image.previousElementSibling.hidden = false;
    image.remove();
    onUnavailable?.();
  };
  container.addEventListener('error', ({ target }) => {
    if (target.matches('.project-photo img')) showPlaceholder(target);
  }, true);
  container.querySelectorAll('.project-photo img').forEach(image => {
    if (image.complete && !image.naturalWidth) showPlaceholder(image);
  });
}

export function renderProjects(grid, status) {
  if (!grid) return;

  const showUnavailable = () => {
    status.textContent = 'Le chargement des photos des projets a rencontré un problème.';
  };

  function renderTiles(entries = [], urls = []) {
    grid.innerHTML = Array.from({ length: 3 }, (_, index) => {
      const entry = entries[index];
      const src = urls[index];
      const tile = `<div class="home-project-media">${projectPhotoMarkup(src, entry?.photo.alt, 'home-project-image', 'eager', '')}</div>`;
      return `<li class="home-project-card">${src
        ? `<a href="${projectHref(entry.id)}" aria-label="${escapeHtml(`Voir ${entry.title} dans Nos projets`)}">${tile}</a>`
        : tile}</li>`;
    }).join('');
  }

  let requested = false;
  async function load() {
    if (requested) return;
    requested = true;
    try {
      const projects = await listPublishedProjects({ limit: 3, coversOnly: true });
      const entries = selectHomeProjectPhotos(projects);
      if (!entries.length) {
        status.textContent = 'Aucune photo de projet n’est disponible pour le moment.';
        return;
      }
      const urls = await signProjectPhotos(entries, 640);
      renderTiles(entries, urls);
      if (urls.some(url => !url)) showUnavailable();
    } catch {
      showUnavailable();
    }
  }

  renderTiles();
  handleUnavailableProjectPhotos(grid, showUnavailable);
  grid.addEventListener('load', ({ target }) => {
    if (target.matches('.home-project-image')) target.classList.add('is-loaded');
  }, true);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void load();
    }, { rootMargin: '160px' });
    observer.observe(grid);
  } else {
    void load();
  }
}
