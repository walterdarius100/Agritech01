import { initFloatingActions } from '../components/floating-actions.js';

export function initMobileMenu() {
  initFloatingActions();
  const menuBtn = document.querySelector('#menuBtn');
  const navLinks = document.querySelector('#navLinks');
  if (!menuBtn || !navLinks) return;

  function setMobileMenuState(isOpen) {
    navLinks.classList.toggle('open', isOpen);
    menuBtn.setAttribute('aria-expanded', String(isOpen));
    menuBtn.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
  }

  menuBtn.addEventListener('click', () => setMobileMenuState(!navLinks.classList.contains('open')));
  navLinks.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMobileMenuState(false);
  });
}

export function initScrollReveal(items = document.querySelectorAll('.reveal')) {
  const revealItems = Array.from(items || []);
  if (!revealItems.length) return;

  if (!('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -60px 0px' });

  revealItems.forEach((item) => {
    if (!item.classList.contains('is-visible')) observer.observe(item);
  });
}

function normalizeContactKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const contactRequestSlugs = {
  'poulet-de-chair': 'poulet-chair',
  'poule-pondeuse': 'poules-pondeuses',
  'cours-en-ligne-cuniculture-rentable-de-0-a-50-000-ht': 'formation-cuniculture',
  'cours-en-ligne-poulet-de-chair-produire-et-vendre-efficacement': 'cours-en-ligne-poulet-chair',
  'cours-en-ligne-apiculture-moderne-simplifiee': 'formation-apiculture',
  'formation-poule-pondeuse': 'formation-poules-pondeuses',
  'formation-en-pisciculture': 'formation-pisciculture'
};

export function buildContactUrl(need) {
  const contactKey = normalizeContactKey(need);
  const demande = contactRequestSlugs[contactKey] || contactKey;
  return `index.html?demande=${encodeURIComponent(demande)}#contact-form`;
}
