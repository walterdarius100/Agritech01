import { NEWSLETTER_SUBSCRIBED_KEY, requestNewsletter } from '../services/newsletter.js';

const actions = new URLSearchParams(window.location.hash.slice(1));
const action = actions.has('confirm') ? 'confirm' : 'unsubscribe';
const token = actions.get(action);

if (token && [...actions].length === 1) {
  const confirm = action === 'confirm';
  const button = document.querySelector('#newsletterActionSubmit');
  const status = document.querySelector('#newsletterActionStatus');
  document.querySelector('#newsletterActionTitle').textContent = confirm
    ? 'Confirmer votre inscription' : 'Vous désinscrire de la newsletter';
  document.querySelector('#newsletterActionDescription').textContent = confirm
    ? 'Confirmez votre choix de recevoir les nouvelles d’Agri-tech par e-mail.'
    : 'Confirmez votre choix de ne plus recevoir la newsletter Agri-tech.';
  button.textContent = confirm ? 'Confirmer mon inscription' : 'Me désinscrire';
  button.hidden = false;

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Traitement en cours…';
    try {
      const response = await requestNewsletter({ action, token });
      const { outcome } = await response.json();
      if (response.ok && outcome === (confirm ? 'confirmed' : 'unsubscribed')) {
        if (confirm) {
          try {
            localStorage.setItem(NEWSLETTER_SUBSCRIBED_KEY, 'true');
          } catch {
            // Subscription state is authoritative in Supabase.
          }
        }
        history.replaceState(null, '', window.location.pathname + window.location.search);
        button.hidden = true;
        status.textContent = confirm ? 'Votre inscription est confirmée.' : 'Votre désinscription est enregistrée.';
        return;
      }
      if (response.status === 400 && outcome === 'invalid_link') {
        status.textContent = 'Ce lien est invalide, a expiré ou a déjà été utilisé.';
        button.hidden = true;
        return;
      }
      throw new Error('Action indisponible');
    } catch {
      status.textContent = 'Impossible de terminer cette action. Veuillez réessayer.';
      button.disabled = false;
    }
  });
}
