const SCROLL_THRESHOLD = 300;
const TOAST_DURATION = 2200;

function isAdminPage() {
  return /(^|\/)admin\.html$/i.test(window.location.pathname);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function createFloatingActionsMarkup() {
  const container = document.createElement('div');
  container.className = 'floating-actions';
  container.id = 'floatingActions';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Actions rapides');

  container.innerHTML = `
    <button class="floating-action floating-action-top" type="button" aria-label="Remonter en haut de la page">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 5.8 5.9 12l1.4 1.4 3.7-3.7V19h2V9.7l3.7 3.7 1.4-1.4L12 5.8Z" />
      </svg>
    </button>
    <button class="floating-action floating-action-share" type="button" aria-label="Partager cette page">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M18 16.1c-.8 0-1.5.3-2 .8L8.9 12.8c.1-.3.1-.5.1-.8s0-.5-.1-.8L16 7.1c.5.5 1.2.8 2 .8a3 3 0 1 0-3-3c0 .3 0 .5.1.8L8 9.8A3 3 0 1 0 8 14.2l7.1 4.2c-.1.2-.1.5-.1.7a3 3 0 1 0 3-3Z" />
      </svg>
    </button>
    <div class="floating-action-status" role="status" aria-live="polite" aria-atomic="true"></div>
  `;

  return container;
}

async function copyCurrentUrl() {
  const currentUrl = window.location.href;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(currentUrl);
    return;
  }

  const fallbackInput = document.createElement('textarea');
  fallbackInput.value = currentUrl;
  fallbackInput.setAttribute('readonly', '');
  fallbackInput.style.position = 'fixed';
  fallbackInput.style.top = '-999px';
  fallbackInput.style.opacity = '0';
  document.body.appendChild(fallbackInput);
  fallbackInput.select();
  document.execCommand('copy');
  fallbackInput.remove();
}

function showStatus(statusElement, message) {
  if (!statusElement) return;

  window.clearTimeout(showStatus.timer);
  statusElement.textContent = message;
  statusElement.classList.add('is-visible');

  showStatus.timer = window.setTimeout(() => {
    statusElement.classList.remove('is-visible');
    statusElement.textContent = '';
  }, TOAST_DURATION);
}

function updateTopButtonVisibility(topButton) {
  topButton.classList.toggle('is-visible', window.scrollY > SCROLL_THRESHOLD);
}

export function initFloatingActions() {
  if (isAdminPage() || document.querySelector('#floatingActions')) return;

  const floatingActions = createFloatingActionsMarkup();
  document.body.appendChild(floatingActions);

  const topButton = floatingActions.querySelector('.floating-action-top');
  const shareButton = floatingActions.querySelector('.floating-action-share');
  const statusElement = floatingActions.querySelector('.floating-action-status');

  updateTopButtonVisibility(topButton);

  window.addEventListener('scroll', () => updateTopButtonVisibility(topButton), { passive: true });

  topButton.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
  });

  shareButton.addEventListener('click', async () => {
    const sharePayload = {
      title: document.title,
      text: 'Découvrez cette page Agri-tech.',
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        showStatus(statusElement, 'Page partagée');
        return;
      }

      await copyCurrentUrl();
      showStatus(statusElement, 'Lien copié');
    } catch (error) {
      if (error?.name === 'AbortError') return;

      try {
        await copyCurrentUrl();
        showStatus(statusElement, 'Lien copié');
      } catch (clipboardError) {
        console.error('Partage indisponible:', clipboardError);
        showStatus(statusElement, 'Partage indisponible');
      }
    }
  });
}
