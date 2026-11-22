import { isEmailValid } from '../utils/validation.js';

export const NEWSLETTER_SUBSCRIBED_KEY = 'agritech:newsletter:subscribed';
export const NEWSLETTER_SHOWN_KEY = 'agritech:newsletter:last-shown';
export const NEWSLETTER_INTERVAL = 7 * 24 * 60 * 60 * 1000;

export function bindNewsletterForm(form, status, source, { preview = false } = {}) {
  const emailInput = form.elements.newsletter_email;
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
    if (preview) {
      show('info', 'Aperçu terminé. Aucune inscription n’a été envoyée.');
      return;
    }

    submitting = true;
    button.setAttribute('aria-disabled', 'true');
    button.textContent = 'Inscription en cours…';
    show('loading', 'Inscription en cours…');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
        signal: AbortSignal.timeout(10000)
      });
      const { outcome } = await response.json();
      if (response.ok && ['subscribed', 'already_subscribed'].includes(outcome)) {
        try {
          localStorage.setItem(NEWSLETTER_SUBSCRIBED_KEY, 'true');
        } catch {
          // Automatic invitations are suppressed if storage is unavailable.
        }
        show('success', outcome === 'subscribed'
          ? 'Merci, votre inscription à la newsletter est confirmée.'
          : 'Cette adresse e-mail est déjà inscrite.');
        if (emailInput.value.trim().toLowerCase() === email) form.reset();
      } else if (response.ok && outcome === 'pending') {
        show('info', 'Une inscription est déjà en attente de confirmation pour cette adresse.');
      } else if (response.ok && outcome === 'contact_required') {
        show('info', 'Pour vous réinscrire, écrivez à contact@agritech509ht.com.');
      } else if (response.status === 429) {
        show('error', 'Trop de tentatives. Veuillez réessayer plus tard.');
      } else {
        throw new Error('Inscription non confirmée');
      }
    } catch {
      show('error', 'Impossible de confirmer votre inscription. Veuillez réessayer.');
    } finally {
      submitting = false;
      button.removeAttribute('aria-disabled');
      button.textContent = label;
    }
  });
  if (preview) show('info', 'Mode aperçu · Envoi simulé.');
  button.disabled = false;
}
