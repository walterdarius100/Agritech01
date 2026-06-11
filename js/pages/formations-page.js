import { courses } from '../data/formations.js';
import { escapeHtml } from '../utils/sanitize.js';
import { getDelayClass } from '../utils/validation.js';
import { buildContactUrl, initMobileMenu, initScrollReveal } from './page-utils.js';

const availableGrid = document.querySelector('#availableCourses');
const upcomingGrid = document.querySelector('#upcomingCourses');

function courseNeed(course) {
  return course.need || `Cours en ligne - ${course.title}`;
}

function renderCourseCard(course, index, mode) {
  const isUpcoming = mode === 'upcoming';
  return `
    <article class="detail-card course-detail-card reveal ${getDelayClass(index)}">
      <img src="${escapeHtml(course.image)}" alt="${escapeHtml(course.title)}" width="1200" height="800" loading="lazy" decoding="async" />
      <div class="detail-card-body">
        <span class="tag">${escapeHtml(course.status)}</span>
        <h3>${escapeHtml(course.title)}</h3>
        <p>${escapeHtml(course.text)}</p>
        <div class="course-meta page-course-meta">
          <span>${escapeHtml(course.level)}</span>
          <span>${escapeHtml(course.duration)}</span>
          <span>${escapeHtml(course.price)}</span>
        </div>
        <ul class="check-list">
          ${(course.outcomes || []).map((outcome) => `<li>${escapeHtml(outcome)}</li>`).join('')}
        </ul>
        <p class="detail-note"><strong>Parcours :</strong> ${escapeHtml(course.track || 'Démarrer un projet agricole structuré')}</p>
        <a class="btn primary full" href="${buildContactUrl(courseNeed(course))}">${isUpcoming ? 'Préinscription' : 'Demander l’accès'}</a>
      </div>
    </article>
  `;
}

function renderCourses() {
  const available = courses.filter((course) => !/bientôt/i.test(course.status));
  const upcoming = courses.filter((course) => /bientôt/i.test(course.status));

  if (availableGrid) {
    availableGrid.innerHTML = available.map((course, index) => renderCourseCard(course, index, 'available')).join('');
  }

  if (upcomingGrid) {
    upcomingGrid.innerHTML = upcoming.map((course, index) => renderCourseCard(course, index, 'upcoming')).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  renderCourses();
  initScrollReveal();
});
