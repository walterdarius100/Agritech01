import { bindNewsletterForm } from '../services/newsletter.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#newsletterForm');
  const status = document.querySelector('#newsletterStatus');
  if (form && status) bindNewsletterForm(form, status, 'footer');
});
