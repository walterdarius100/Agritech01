import { EMAILJS_CONFIG } from '../config.js';
import { createSubmissionService } from '../components/contact-form.js';
import { initNewsletterForm } from '../components/newsletter-form.js';

document.addEventListener('DOMContentLoaded', () => {
  if (window.emailjs) window.emailjs.init({
    publicKey: EMAILJS_CONFIG.publicKey, blockHeadless: true,
    limitRate: { id: 'agritech-contact-form', throttle: 10000 }
  });
  initNewsletterForm(document, createSubmissionService(EMAILJS_CONFIG, { emailjs: window.emailjs }));
});
