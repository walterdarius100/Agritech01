import { initMobileMenu } from './page-utils.js';
import { getPublishedProject, listPublishedProjects, projectHref, signProjectPhotos } from '../services/projects-service.js';
import { handleUnavailableProjectPhotos, projectPhotoMarkup } from '../components/render-projects.js';
import { escapeHtml } from '../utils/sanitize.js';

const PAGE_SIZE = 9;
const SITE_URL = 'https://agritech509ht.com/';
const status = document.querySelector('#projectsStatus');
const list = document.querySelector('#projectsList');
const detail = document.querySelector('#projectDetail');
const params = new URLSearchParams(window.location.search);

function metadata(project) {
  const items = [['Lieu', project.location], ['Période', project.period], ['Domaine', project.domain]];
  return `<dl class="project-facts">${items.filter(([, value]) => value).map(([label, value]) =>
    `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;
}

function canonical(path) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.append(link);
  }
  link.href = new URL(path, SITE_URL).href;
}

function listHref(page) {
  return page === 1 ? 'projets.html' : `projets.html?page=${page}`;
}

async function loadList() {
  const value = Number(params.get('page'));
  const page = Number.isSafeInteger(value) && value > 0 && value <= 10000 ? value : 1;
  canonical(listHref(page));
  const result = await listPublishedProjects({ limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE });
  const projects = result.slice(0, PAGE_SIZE);
  const covers = projects.filter(project => project.photos.length).map(project => ({ id: project.id, photo: project.photos[0] }));
  const urls = await signProjectPhotos(covers, 640).catch(() => []);
  const coverById = new Map(covers.map((cover, index) => [cover.id, urls[index]]));
  list.innerHTML = projects.map(project => `
    <article class="article-card public-project-card">
      <div class="article-card-image">${projectPhotoMarkup(coverById.get(project.id), project.photos[0]?.alt)}</div>
      <div class="article-card-body">
        <h2><a href="${projectHref(project.id)}">${escapeHtml(project.title)}</a></h2>
        <p>${escapeHtml(project.summary)}</p>
        ${metadata(project)}
      </div>
    </article>`).join('');

  handleUnavailableProjectPhotos(list);
  status.textContent = projects.length ? '' : page === 1 ? 'Aucun projet publié pour le moment.' : 'Aucun projet sur cette page.';
  const pagination = document.querySelector('#projectsPagination');
  if (page > 1 || result.length > PAGE_SIZE) {
    pagination.hidden = false;
    pagination.innerHTML = `
      ${page > 1 ? `<a class="btn secondary" rel="prev" href="${listHref(page - 1)}">Page précédente</a>` : ''}
      ${result.length > PAGE_SIZE ? `<a class="btn secondary" rel="next" href="${listHref(page + 1)}">Page suivante</a>` : ''}`;
  }
}

async function loadDetail() {
  const project = await getPublishedProject(params.get('id') || '');
  if (!project) {
    document.querySelector('meta[name="robots"]').content = 'noindex, follow';
    status.insertAdjacentHTML('beforebegin', '<h1>Projet introuvable</h1>');
    status.textContent = 'Cette réalisation est introuvable ou a été retirée.';
    return;
  }

  const url = projectHref(project.id);
  canonical(url);
  document.title = `${project.title} | Agri-tech`;
  document.querySelector('meta[name="description"]').content = project.summary;
  document.querySelector('meta[property="og:title"]').content = document.title;
  document.querySelector('meta[property="og:description"]').content = project.summary;
  const entries = project.photos.map(photo => ({ id: project.id, photo }));
  const urls = await signProjectPhotos(entries, 1440).catch(() => []);
  detail.innerHTML = `
    <header class="article-detail-hero project-detail-heading">
      <div class="article-detail-hero-inner">
        <a class="card-link project-back-in-hero" href="projets.html">← Tous les projets</a>
        <div class="article-detail-meta"><span class="article-detail-category">Réalisation Agri-tech</span></div>
        <h1 class="article-detail-title">${escapeHtml(project.title)}</h1>
        <p class="article-detail-excerpt">${escapeHtml(project.summary)}</p>
        ${metadata(project)}
      </div>
    </header>
    <div class="section-pad article-layout">
      ${project.photos.length ? `<div class="article-cover-wrap project-cover">
        ${projectPhotoMarkup(urls[0], project.photos[0].alt, '', 'eager')}
      </div>` : ''}
      <div class="article-content project-detail-text">
        <h2>Présentation du projet</h2>
        <p>${escapeHtml(project.details)}</p>
      </div>
      ${project.photos.length > 1 ? `<div class="public-project-gallery">
        ${project.photos.slice(1).map((photo, index) => projectPhotoMarkup(urls[index + 1], photo.alt)).join('')}
      </div>` : ''}
    </div>`;
  handleUnavailableProjectPhotos(detail);
}

initMobileMenu();
(list ? loadList() : loadDetail()).catch(() => {
  status.textContent = 'Les projets sont momentanément indisponibles. Réessayez dans quelques instants.';
  if (detail) status.insertAdjacentHTML('beforebegin', '<h1>Projet indisponible</h1>');
});
