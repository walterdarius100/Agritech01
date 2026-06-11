export function initMobileMenu() {
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
  const revealItems = Array.from(items);
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
  return `index.html?need=${encodeURIComponent(need)}#contact`;
}
