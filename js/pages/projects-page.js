import { initMobileMenu } from './page-utils.js';
import { countPublishedProjects, findPublishedProjectOffset, listPublishedProjects,
  projectAnchor, projectPhotos, signProjectPhotos } from '../services/projects-service.js';
import { handleUnavailableProjectPhotos, projectPhotoMarkup } from '../components/render-projects.js';
import { escapeHtml } from '../utils/sanitize.js';

const PAGE_SIZE = 2;
const status = document.querySelector('#projectsStatus');
const list = document.querySelector('#projectsList');
const pagination = document.querySelector('#projectsPagination');
let galleryObserver;
let loadVersion = 0;

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

  galleryObserver = observer;
  list.querySelectorAll('.portfolio-gallery').forEach(gallery => {
    if (observer) observer.observe(gallery);
    else void loadGallery(gallery);
  });
}

function pageHref(page) {
  const params = new URLSearchParams(location.search);
  params.set('page', page);
  return escapeHtml(`?${params}#projectsList`);
}

function renderPagination(page, totalPages) {
  pagination.hidden = totalPages <= 1;
  if (pagination.hidden) {
    pagination.innerHTML = '';
    return;
  }

  const arrow = (target, label, symbol) => target < 1 || target > totalPages
    ? `<span class="pagination-arrow is-disabled" aria-disabled="true" aria-label="${label}">${symbol}</span>`
    : `<a class="pagination-arrow" href="${pageHref(target)}" aria-label="${label}">${symbol}</a>`;
  const dots = Array.from({ length: totalPages }, (_, index) => {
    const number = index + 1;
    return number === page
      ? `<span class="pagination-dot is-active" aria-label="Page ${number} actuelle" aria-current="page"></span>`
      : `<a class="pagination-dot" href="${pageHref(number)}" aria-label="Aller à la page ${number}"></a>`;
  }).join('');
  pagination.innerHTML = `
    ${arrow(page - 1, 'Page précédente', '‹')}
    <div class="pagination-dots" aria-label="Pages disponibles">${dots}</div>
    ${arrow(page + 1, 'Page suivante', '›')}
  `;
}

async function loadPortfolio() {
  const version = ++loadVersion;
  const fragment = location.hash.slice(1);
  const requestedPage = Number(new URLSearchParams(location.search).get('page'));
  try {
    const [count, anchorOffset] = await Promise.all([
      countPublishedProjects(),
      fragment.startsWith('projet-') ? findPublishedProjectOffset(fragment.slice(7).toLowerCase()) : null
    ]);
    if (version !== loadVersion) return;
    const totalPages = Math.ceil(count / PAGE_SIZE);
    const preferredPage = anchorOffset === null ? requestedPage : Math.floor(anchorOffset / PAGE_SIZE) + 1;
    const page = Math.max(1, Math.min(Number.isSafeInteger(preferredPage) ? preferredPage : 1, totalPages));
    const projects = count ? await listPublishedProjects({
      limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, includeDetails: true
    }) : [];
    if (version !== loadVersion) return;

    galleryObserver?.disconnect();
    list.innerHTML = projects.map(renderProject).join('');
    status.textContent = projects.length ? '' : 'Aucun projet publié pour le moment.';
    renderPagination(page, totalPages);
    loadGalleries(new Map(projects.map(project => [projectAnchor(project.id), project])));

    // Project fragments can only be resolved once the relevant page is rendered.
    const target = fragment === 'projectsList' ? list : document.getElementById(fragment.toLowerCase());
    target?.scrollIntoView({ behavior: 'instant' });
  } catch {
    if (version !== loadVersion) return;
    status.textContent = 'Les projets sont momentanément indisponibles. Réessayez dans quelques instants.';
  }
}

initMobileMenu();
handleUnavailableProjectPhotos(list);
window.addEventListener('hashchange', ({ oldURL, newURL }) => {
  if ([oldURL, newURL].some(url => new URL(url).hash.startsWith('#projet-'))) void loadPortfolio();
});
void loadPortfolio();
