import { requestNewsletter } from '../services/newsletter.js';

const actions = new URLSearchParams(window.location.hash.slice(1));
const token = actions.get('unsubscribe');
const description = document.querySelector('#newsletterActionDescription');

if (actions.has('confirm')) {
  description.textContent = 'Ce lien de confirmation a été retiré. Pour vous inscrire, utilisez le formulaire newsletter sur le site Agri-tech.';
} else if (token && [...actions].length === 1) {
  const button = document.querySelector('#newsletterActionSubmit');
  const status = document.querySelector('#newsletterActionStatus');
  document.querySelector('#newsletterActionTitle').textContent = 'Vous désinscrire de la newsletter';
  description.textContent = 'Confirmez votre choix de ne plus recevoir la newsletter Agri-tech.';
  button.textContent = 'Me désinscrire';
  button.hidden = false;

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Traitement en cours…';
    try {
      const response = await requestNewsletter({ action: 'unsubscribe', token });
      const { outcome } = await response.json();
      if (response.ok && outcome === 'unsubscribed') {
        history.replaceState(null, '', window.location.pathname + window.location.search);
        button.hidden = true;
        status.textContent = 'Votre désinscription est enregistrée.';
        return;
      }
      if (response.status === 400 && outcome === 'invalid_link') {
        status.textContent = 'Ce lien de désinscription est invalide.';
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
