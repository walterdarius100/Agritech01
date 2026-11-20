import { initMobileMenu } from './page-utils.js';
import { listPublishedProjects, projectAnchor, projectPhotos, signProjectPhotos } from '../services/projects-service.js';
import { handleUnavailableProjectPhotos, projectPhotoMarkup } from '../components/render-projects.js';
import { escapeHtml } from '../utils/sanitize.js';

const BATCH_SIZE = 50;
const status = document.querySelector('#projectsStatus');
const list = document.querySelector('#projectsList');

function renderProject(project) {
  const anchor = projectAnchor(project.id);
  const facts = [['Lieu', project.location], ['Période', project.period]].filter(([, value]) => value);
  const paragraphs = project.details.trim().split(/\r?\n(?:[^\S\r\n]*\r?\n)+/);
  const photos = projectPhotos(project);

  return `
    <article class="portfolio-project" id="${anchor}" aria-labelledby="${anchor}-title">
      <div class="portfolio-copy">
        ${project.domain ? `<span class="eyebrow">${escapeHtml(project.domain)}</span>` : ''}
        <h2 id="${anchor}-title">${escapeHtml(project.title)}</h2>
        ${facts.length ? `<dl class="project-facts">${facts.map(([label, value]) =>
          `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>` : ''}
        <div class="portfolio-description">${paragraphs.map(paragraph =>
          `<p>${escapeHtml(paragraph)}</p>`).join('')}</div>
      </div>
      <div class="portfolio-gallery" data-photo-count="${photos.length}">
        ${photos.length ? photos.map(photo => projectPhotoMarkup('', photo.alt)).join('') : projectPhotoMarkup('')}
      </div>
    </article>`;
}

function loadGalleries(projects) {
  async function loadGallery(gallery) {
    const project = projects.get(gallery.closest('article').id);
    const photos = projectPhotos(project);
    if (!photos.length) return;
    const width = matchMedia('(min-width: 621px)').matches ? 1440 : 640;
    const urls = await signProjectPhotos(photos.map(photo => ({ id: project.id, photo })), width).catch(() => []);
    gallery.innerHTML = photos.map((photo, index) => projectPhotoMarkup(urls[index], photo.alt, '', 'eager')).join('');
    gallery.classList.add('has-photos');
  }

  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      void loadGallery(entry.target);
    }
  }, { rootMargin: '140px' }) : null;

  list.querySelectorAll('.portfolio-gallery').forEach(gallery => {
    if (observer) observer.observe(gallery);
    else void loadGallery(gallery);
  });
}

async function loadPortfolio() {
  const projects = [];
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const batch = await listPublishedProjects({ limit: BATCH_SIZE, offset, includeDetails: true });
    projects.push(...batch);
    if (batch.length < BATCH_SIZE) break;
  }

  handleUnavailableProjectPhotos(list);
  list.innerHTML = projects.map(renderProject).join('');
  status.textContent = projects.length ? '' : 'Aucun projet publié pour le moment.';
  loadGalleries(new Map(projects.map(project => [projectAnchor(project.id), project])));

  // The browser may have resolved the fragment before projects were loaded.
  document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
}

initMobileMenu();
loadPortfolio().catch(() => {
  status.textContent = 'Les projets sont momentanément indisponibles. Réessayez dans quelques instants.';
});
