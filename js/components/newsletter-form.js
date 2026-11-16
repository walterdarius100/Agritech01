import { isEmailValid } from '../utils/validation.js';

export function initNewsletterForm(root, submit) {
  const form = root.querySelector('#newsletterForm');
  if (!form || form.dataset.newsletterBound) return;
  form.dataset.newsletterBound = 'true';
  const input = root.querySelector('#newsletterEmail');
  const consent = root.querySelector('#newsletterConsent');
  const button = root.querySelector('#newsletterSubmit');
  const status = root.querySelector('#newsletterStatus');
  let busy = false;
  const show = (type, text) => {
    status.className = `newsletter-status show ${type}`;
    status.textContent = text;
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const email = input.value.trim();
    if (!isEmailValid(email)) return show('error', 'Veuillez entrer une adresse email valide.');
    if (!consent?.checked) return show('error', 'Veuillez accepter de recevoir la newsletter.');
    busy = true;
    button.disabled = true;
    button.textContent = 'Transmission...';
    form.setAttribute('aria-busy', 'true');
    try {
      const result = await submit({
        from_name: 'Abonné newsletter', from_email: email, phone: '', need: 'Newsletter',
        message: 'Demande d’inscription à la newsletter depuis le footer.',
        consent: 'Oui', consent_text: consent.labels?.[0]?.textContent.trim() || 'J’accepte de recevoir la newsletter Agri-tech.',
        consent_version: 'newsletter-v1', source: 'Footer newsletter', SOURCE: 'Footer newsletter',
        TYPE_CONTACT: 'Newsletter', date: new Date().toISOString()
      }, true);
      if (result.notification !== 'accepted') {
        show('error', 'La transmission n’a pas pu être confirmée. Votre adresse est conservée. Vérifiez auprès d’Agri-tech avant de réessayer.');
      } else {
        show('error', 'Votre demande a été transmise à Agri-tech. L’enregistrement de votre inscription reste non confirmé. Ne la renvoyez pas ; contactez Agri-tech pour vérification.');
      }
    } catch {
      show('error', 'Le résultat est incertain. Votre adresse est conservée. Contactez Agri-tech avant de réessayer.');
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = 'S’inscrire';
      form.setAttribute('aria-busy', 'false');
    }
  });
}
