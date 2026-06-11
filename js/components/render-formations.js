import { escapeHtml } from '../utils/sanitize.js';
import { getDelayClass } from '../utils/validation.js';

export function renderCourses({ courseGrid, courses, setupScrollReveal, updateCourseCarousel }) {
  if (!courseGrid) return;

  courseGrid.innerHTML = courses
    .map((course, index) => `
      <article class="course-card reveal ${getDelayClass(index)}"${course.cardLink ? ` data-need="${escapeHtml(course.need)}" data-contact-card="true"` : ''}>
        <div class="course-header">
          <img src="${escapeHtml(course.image)}" alt="${escapeHtml(course.title)}" width="1200" height="800" loading="lazy" decoding="async" />
          <span class="course-badge">Formation</span>
        </div>
        <div class="course-body">
          <h3>${escapeHtml(course.title)}</h3>
          <p>${escapeHtml(course.text)}</p>
          <div class="course-meta">
            <span>${escapeHtml(course.level)}</span>
            <span>${escapeHtml(course.duration)}</span>
            <span>${escapeHtml(course.status)}</span>
          </div>
          <div class="course-price">${escapeHtml(course.price)}</div>
          <p class="bonus">🎁 ${escapeHtml(course.bonus)}</p>
          <a href="#contact" data-need="${escapeHtml(course.need || `Cours en ligne - ${course.title}`)}" class="btn primary full">${escapeHtml(course.cta || 'Accéder à la formation')}</a>
        </div>
      </article>
    `)
    .join('');

  setupScrollReveal?.(courseGrid.querySelectorAll('.reveal'));
  updateCourseCarousel?.();
}
