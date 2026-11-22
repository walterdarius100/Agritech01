import {
  bindNewsletterForm, NEWSLETTER_INTERVAL, NEWSLETTER_SHOWN_KEY, NEWSLETTER_SUBSCRIBED_KEY
} from '../services/newsletter.js';

const SESSION_SHOWN_KEY = 'agritech:newsletter:session-shown';

function mayShowInvitation() {
  try {
    const lastShown = localStorage.getItem(NEWSLETTER_SHOWN_KEY);
    return !sessionStorage.getItem(SESSION_SHOWN_KEY) &&
      !localStorage.getItem(NEWSLETTER_SUBSCRIBED_KEY) &&
      (lastShown === null || Date.now() - Number(lastShown) >= NEWSLETTER_INTERVAL);
  } catch {
    return false;
  }
}

const PREVIEW_ENDPOINT = '/api/newsletter?previewNewsletter=1';

export async function initArticleNewsletterPreview() {
  if (new URLSearchParams(window.location.search).get('previewNewsletter') !== '1') return false;
  const dialog = document.querySelector('#articleNewsletter');
  if (typeof dialog?.showModal !== 'function') return false;

  try {
    const response = await fetch(PREVIEW_ENDPOINT, { signal: AbortSignal.timeout(3000) });
    if (!response.ok || (await response.json()).preview !== true) return false;
  } catch {
    return false;
  }

  const form = dialog.querySelector('form');
  form.action = PREVIEW_ENDPOINT;
  bindNewsletterForm(form, dialog.querySelector('[role="status"]'), 'article', { preview: true });
  prepareDialog(dialog)();
  return true;
}

function prepareDialog(dialog) {
  const closeButton = dialog.querySelector('.newsletter-dialog-close');
  closeButton.addEventListener('click', () => dialog.close());
  let previousFocus;
  dialog.addEventListener('close', () => previousFocus?.focus({ preventScroll: true }));
  return () => {
    previousFocus = document.activeElement;
    dialog.showModal();
  };
}

export function initArticleNewsletter(content) {
  const dialog = document.querySelector('#articleNewsletter');
  if (!content || typeof dialog?.showModal !== 'function' || !mayShowInvitation()) return;

  bindNewsletterForm(dialog.querySelector('form'), dialog.querySelector('[role="status"]'), 'article');
  const openDialog = prepareDialog(dialog);

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
      sessionStorage.setItem(SESSION_SHOWN_KEY, 'true');
      localStorage.setItem(NEWSLETTER_SHOWN_KEY, String(Date.now()));
    } catch {
      stopWatching();
      return;
    }

    stopWatching();
    openDialog();
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
