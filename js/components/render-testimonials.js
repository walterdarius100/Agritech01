import { escapeHtml } from '../utils/sanitize.js';

export function renderTestimonials({ testimonialTrack, testimonialDots, testimonials, updateTestimonialCarousel }) {
  if (!testimonialTrack) return;

  testimonialTrack.innerHTML = testimonials
    .map((testimonial) => `
      <article class="testimonial-card">
        <img src="${escapeHtml(testimonial.image)}" alt="${escapeHtml(testimonial.name)}" class="testimonial-image" width="1200" height="800" loading="lazy" decoding="async" />
        <div class="testimonial-content">
          <div class="testimonial-author">
            <strong>${escapeHtml(testimonial.name)}</strong>
            <span>${escapeHtml(testimonial.role)}</span>
          </div>
          <div class="testimonial-stars" aria-label="5 étoiles">★★★★★</div>
          <p class="testimonial-text">${escapeHtml(testimonial.text)}</p>
        </div>
      </article>
    `)
    .join('');

  if (testimonialDots) {
    testimonialDots.innerHTML = testimonials
      .map((testimonial, index) => `
        <button class="testimonial-dot" type="button" aria-label="Afficher le témoignage ${index + 1} : ${escapeHtml(testimonial.name)}" data-testimonial-index="${index}"></button>
      `)
      .join('');
  }

  updateTestimonialCarousel?.();
}
