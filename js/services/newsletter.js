import { NEWSLETTER_API_URL, NEWSLETTER_SITE_ORIGIN } from '../config/newsletter-config.js';
import { isEmailValid } from '../utils/validation.js';

export const NEWSLETTER_SUBSCRIBED_KEY = 'agritech:newsletter:subscribed';
export const NEWSLETTER_SHOWN_KEY = 'agritech:newsletter:last-shown';
export const NEWSLETTER_INTERVAL = 7 * 24 * 60 * 60 * 1000;

export async function requestNewsletter(payload) {
  if (window.location.origin !== NEWSLETTER_SITE_ORIGIN) throw new Error('Newsletter indisponible sur cette origine');
  return fetch(NEWSLETTER_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000)
  });
}

export function bindNewsletterForm(form, status, source, { preview = false } = {}) {
  const emailInput = form.elements.newsletter_email;
  const consent = form.elements.newsletter_consent;
  const button = form.querySelector('button[type="submit"]');
  const label = button.textContent;
  let submitting = false;

  function show(type, message) {
    status.className = `newsletter-status show ${type}`;
    status.textContent = message;
  }

  emailInput.addEventListener('input', () => emailInput.removeAttribute('aria-invalid'));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const email = emailInput.value.trim().toLowerCase();

    if (!isEmailValid(email) || email.length > 254) {
      show('error', email ? 'Veuillez saisir une adresse e-mail valide.' : 'Veuillez saisir votre adresse e-mail.');
      emailInput.setAttribute('aria-invalid', 'true');
      emailInput.focus();
      return;
    }

    emailInput.removeAttribute('aria-invalid');
    if (!consent.checked) {
      show('error', 'Veuillez accepter de recevoir la newsletter Agri-tech.');
      consent.focus();
      return;
    }
    if (preview) {
      show('info', 'Aperçu terminé. Aucune inscription n’a été envoyée.');
      return;
    }

    submitting = true;
    button.setAttribute('aria-disabled', 'true');
    button.textContent = 'Inscription en cours…';
    show('loading', 'Inscription en cours…');

    try {
      const response = await requestNewsletter({ action: 'subscribe', email, source, consent: true });
      const { outcome } = await response.json();
      if (response.status === 202 && outcome === 'received') {
        show('success', 'Merci ! Votre demande d’inscription à la newsletter Agri-tech a bien été reçue.');
        try {
          localStorage.setItem(NEWSLETTER_SUBSCRIBED_KEY, 'true');
        } catch {
          // The server remains authoritative, even when browser storage is blocked.
        }
        if (emailInput.value.trim().toLowerCase() === email) form.reset();
      } else if (response.status === 400 && outcome === 'invalid') {
        show('error', 'Veuillez saisir une adresse e-mail valide.');
      } else if (response.status === 400 && outcome === 'consent_required') {
        show('error', 'Veuillez accepter de recevoir la newsletter Agri-tech.');
      } else if (response.status === 429) {
        show('error', 'Trop de tentatives. Veuillez réessayer plus tard.');
      } else {
        throw new Error('Demande indisponible');
      }
    } catch {
      show('error', 'Impossible de traiter votre demande. Veuillez réessayer.');
    } finally {
      submitting = false;
      button.removeAttribute('aria-disabled');
      button.textContent = label;
    }
  });
  if (preview) show('info', 'Mode aperçu · Envoi simulé.');
  button.disabled = false;
}
