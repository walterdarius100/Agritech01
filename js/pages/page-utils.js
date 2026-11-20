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
  const navbar = menuBtn.closest('.navbar');
  navbar.addEventListener('click', event => {
    if (event.target.closest('a')) setMobileMenuState(false);
  });
  navbar.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !navLinks.classList.contains('open')) return;
    setMobileMenuState(false);
    menuBtn.focus();
  });
  const desktop = window.matchMedia('(min-width: 1021px)');
  desktop.addEventListener('change', () => setMobileMenuState(false));

  const home = navLinks.querySelector('[href="index.html"][aria-current="page"]');
  if (home) {
    const links = [...navLinks.querySelectorAll('a')];
    function updateHomeActiveLink() {
      const section = links.find(link => window.location.hash && link.hash === window.location.hash);
      links.forEach(link => link.removeAttribute('aria-current'));
      (section || home).setAttribute('aria-current', section ? 'location' : 'page');
    }
    updateHomeActiveLink();
    window.addEventListener('hashchange', updateHomeActiveLink);
  }
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

export function buildContactUrl(need) {
  return `index.html?need=${encodeURIComponent(need)}#leadForm`;
}
