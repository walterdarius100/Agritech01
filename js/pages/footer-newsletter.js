import { EMAILJS_CONFIG, FORM_STATUS_DURATION, NEWSLETTER_ERROR_MESSAGE, NEWSLETTER_SUCCESS_MESSAGE } from '../config.js';
import { storeLead } from '../components/contact-form.js';
import { isEmailValid } from '../utils/validation.js';
import { getSafeErrorMessage, logClientError } from '../utils/error-messages.js';

function isEmailJsConfigured() {
  return Boolean(EMAILJS_CONFIG.publicKey && EMAILJS_CONFIG.serviceId && EMAILJS_CONFIG.templateId);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#newsletterForm');
  const emailInput = document.querySelector('#newsletterEmail');
  const submitBtn = document.querySelector('#newsletterSubmit');
  const status = document.querySelector('#newsletterStatus');
  let statusTimer = null;

  if (!form || !emailInput || !submitBtn || !status) return;

  if (window.emailjs) {
    window.emailjs.init({
      publicKey: EMAILJS_CONFIG.publicKey,
      blockHeadless: true,
      limitRate: { id: 'agritech-contact-form', throttle: 10000 }
    });
  }

  function clearStatusTimer() {
    if (!statusTimer) return;
    window.clearTimeout(statusTimer);
    statusTimer = null;
  }

  function setStatus(type, message, shouldAutoHide = false) {
    clearStatusTimer();
    status.className = `newsletter-status show ${type}`;
    status.textContent = message;

    if (shouldAutoHide) {
      statusTimer = window.setTimeout(() => {
        status.className = 'newsletter-status';
        status.textContent = '';
        statusTimer = null;
      }, FORM_STATUS_DURATION);
    }
  }

  function setSubmitState(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Inscription...' : 'S’inscrire';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    clearStatusTimer();

    if (!email) {
      setStatus('error', 'Veuillez entrer votre adresse email.');
      return;
    }

    if (!isEmailValid(email)) {
      setStatus('error', 'Veuillez entrer une adresse email valide.');
      return;
    }

    if (!window.emailjs || !isEmailJsConfigured()) {
      setStatus('error', NEWSLETTER_ERROR_MESSAGE);
      return;
    }

    const payload = {
      from_name: 'Abonné newsletter',
      from_email: email,
      phone: '',
      need: 'Newsletter',
      message: 'Inscription à la newsletter depuis le footer.',
      consent: 'Oui',
      source: 'Footer newsletter',
      SOURCE: 'Footer newsletter',
      TYPE_CONTACT: 'Newsletter',
      date: new Date().toISOString()
    };

    try {
      setSubmitState(true);
      setStatus('success', 'Inscription en cours...');
      await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, payload);
      await storeLead(EMAILJS_CONFIG, payload);
      setStatus('success', NEWSLETTER_SUCCESS_MESSAGE, true);
      form.reset();
    } catch (error) {
      logClientError('newsletter', error);
      setStatus('error', getSafeErrorMessage('newsletter', error), true);
    } finally {
      setSubmitState(false);
    }
  });
});
