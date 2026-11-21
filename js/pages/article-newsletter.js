import {
  bindNewsletterForm, NEWSLETTER_INTERVAL, NEWSLETTER_SHOWN_KEY, NEWSLETTER_SUBSCRIBED_KEY
} from '../services/newsletter.js';

function mayShowInvitation() {
  try {
    const lastShown = localStorage.getItem(NEWSLETTER_SHOWN_KEY);
    return !localStorage.getItem(NEWSLETTER_SUBSCRIBED_KEY) &&
      (lastShown === null || Date.now() - Number(lastShown) >= NEWSLETTER_INTERVAL);
  } catch {
    return false;
  }
}

export function initArticleNewsletter(content) {
  const dialog = document.querySelector('#articleNewsletter');
  if (!content || typeof dialog?.showModal !== 'function' || !mayShowInvitation()) return;

  bindNewsletterForm(dialog.querySelector('form'), dialog.querySelector('[role="status"]'), 'article');
  const closeButton = dialog.querySelector('.newsletter-dialog-close');
  closeButton.addEventListener('click', () => dialog.close());
  let previousFocus;
  dialog.addEventListener('close', () => previousFocus?.focus({ preventScroll: true }));

  let previousScroll = window.scrollY;
  let readerInteracted = false;
  let framePending = false;
  const readerEvents = ['wheel', 'touchmove', 'pointerdown', 'keydown'];

  function markInteraction(event) {
    if (event.defaultPrevented) return;
    if (event.type === 'keydown' &&
        !['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) return;
    readerInteracted = true;
  }

  function stopWatching() {
    window.removeEventListener('scroll', onScroll);
    for (const type of readerEvents) window.removeEventListener(type, markInteraction);
  }

  function present() {
    if (!mayShowInvitation() || document.visibilityState !== 'visible') return;

    try {
      // Persist before placing the window in the top layer. A failed write suppresses it.
      localStorage.setItem(NEWSLETTER_SHOWN_KEY, String(Date.now()));
    } catch {
      stopWatching();
      return;
    }

    stopWatching();
    previousFocus = document.activeElement;
    dialog.showModal();
  }

  function onScroll() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(() => {
      framePending = false;
      const scrolledDown = window.scrollY > previousScroll;
      previousScroll = window.scrollY;
      if (!readerInteracted || !scrolledDown || !mayShowInvitation()) return;

      const { top, height } = content.getBoundingClientRect();
      const viewport = window.innerHeight;
      if (height < Math.max(800, viewport) || viewport < top + height * 0.55) return;
      if (top + height <= 0) return;

      if (navigator.locks) {
        // Serialize the storage check and write when two article tabs reach the threshold.
        navigator.locks.request(NEWSLETTER_SHOWN_KEY, present).catch(() => {});
      } else {
        present();
      }
    });
  }

  for (const type of readerEvents) window.addEventListener(type, markInteraction, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
}
