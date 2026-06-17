import { EMAILJS_CONFIG, FORM_ERROR_MESSAGE, FORM_STATUS_DURATION, FORM_SUCCESS_MESSAGE, NEWSLETTER_ERROR_MESSAGE, NEWSLETTER_SUCCESS_MESSAGE, PARTNERSHIP_NEED } from './config.js';
import { services } from './data/services.js';
import { courses } from './data/formations.js';
import { testimonials } from './data/testimonials.js';
import { renderCourses } from './components/render-formations.js';
import { renderFilters, renderServices } from './components/render-services.js';
import { renderTestimonials } from './components/render-testimonials.js';
import { getPublishedArticles, renderArticleCards } from './components/render-articles.js';
import { clampCarouselIndex } from './components/carousel.js';
import { storeLead as storeLeadRequest } from './components/contact-form.js';
import { initFloatingActions } from './components/floating-actions.js';
import { escapeHtml, sanitizePhone } from './utils/sanitize.js';
import { isEmailValid } from './utils/validation.js';
import { getSafeErrorMessage, logClientError } from './utils/error-messages.js';

// Agri-Tech application bootstrap.
document.addEventListener('DOMContentLoaded', function initAgriTechSite() {
  if (window.emailjs) {
    window.emailjs.init({
      publicKey: EMAILJS_CONFIG.publicKey,
      blockHeadless: true,
      limitRate: { id: 'agritech-contact-form', throttle: 10000 }
    });
  }
  const elements = {
    serviceGrid: document.querySelector('#serviceGrid'),
    courseGrid: document.querySelector('#courseGrid'),
    coursePrev: document.querySelector('#coursePrev'),
    courseNext: document.querySelector('#courseNext'),
    courseDots: document.querySelector('#courseDots'),
    testimonialTrack: document.querySelector('#testimonialTrack'),
    testimonialDots: document.querySelector('#testimonialDots'),
    partnershipTrack: document.querySelector('#partnershipTrack'),
    partnershipNext: document.querySelector('#partnershipNext'),
    partnershipDots: document.querySelector('#partnershipDots'),
    prevBtn: document.querySelector('#prevBtn'),
    nextBtn: document.querySelector('#nextBtn'),
    filters: document.querySelector('#filters'),
    needSelect: document.querySelector('#need'),
    menuBtn: document.querySelector('#menuBtn'),
    navLinks: document.querySelector('#navLinks'),
    brandHome: document.querySelector('[data-scroll-top]'),
    form: document.querySelector('#leadForm'),
    messageField: document.querySelector('#messageField'),
    messageInput: document.querySelector('#message'),
    submitBtn: document.querySelector('#submitBtn'),
    formStatus: document.querySelector('#formStatus'),
    nameInput: document.querySelector('#name'),
    emailInput: document.querySelector('#email'),
    phoneInput: document.querySelector('#phone'),
    consentInput: document.querySelector('#consent'),
    honeypotInput: document.querySelector('#website'),
    newsletterForm: document.querySelector('#newsletterForm'),
    newsletterEmailInput: document.querySelector('#newsletterEmail'),
    newsletterSubmitBtn: document.querySelector('#newsletterSubmit'),
    newsletterStatus: document.querySelector('#newsletterStatus'),
    homeArticlesGrid: document.querySelector('#homeArticlesGrid')
  };

  const partnershipNeed = PARTNERSHIP_NEED;
  const featuredServices = services.slice(0, 3);
  const featuredCourses = courses.slice(0, 3);
  const categories = ['Tous', ...new Set(featuredServices.map((service) => service.category))];
  const demandeMap = {
    'poulet-chair': ['Poulet de chair'],
    'poules-pondeuses': ['Poule pondeuse', 'Poules pondeuses'],
    cuniculture: ['Cuniculture'],
    apiculture: ['Apiculture'],
    pisciculture: ['Pisciculture'],
    pepiniere: ['Pépinière'],
    porcherie: ['Porcherie'],
    'incubateur-ecloserie': ['Incubateur / Écloserie'],
    gabionnage: ['Gabionnage'],
    irrigation: ['Irrigation'],
    biogaz: ['Biogaz'],
    'cloture-metallique': ['Clôture métallique'],
    partenariat: [partnershipNeed, 'Collaboration'],
    'formation-cuniculture': ['Cours en ligne - Cuniculture rentable (de 0 à 50 000 HT)', 'Formation cuniculture', 'Cours cuniculture'],
    'formation-poulet-chair': ['Cours en ligne - Poulet de chair : produire et vendre efficacement', 'Cours en ligne poulet de chair', 'Formation poulet de chair'],
    'cours-poulet-chair': ['Cours en ligne - Poulet de chair : produire et vendre efficacement', 'Cours en ligne poulet de chair', 'Formation poulet de chair'],
    'cours-en-ligne-poulet-chair': ['Cours en ligne - Poulet de chair : produire et vendre efficacement', 'Cours en ligne poulet de chair', 'Formation poulet de chair'],
    'formation-apiculture': ['Cours en ligne - Apiculture moderne simplifiée', 'Formation apiculture', 'Cours apiculture'],
    'formation-poules-pondeuses': ['Formation poule pondeuse', 'Formation poules pondeuses', 'Cours poules pondeuses'],
    'formation-pisciculture': ['Formation en pisciculture', 'Formation pisciculture', 'Cours pisciculture']
  };
  let testimonialIndex = 0;
  let testimonialTimer = null;
  let partnershipIndex = 0;
  let partnershipTimer = null;
  let courseIndex = 0;
  let resizeFrame = null;
  let formResetTimer = null;
  let formStatusTimer = null;
  let newsletterStatusTimer = null;


  function isEmailJsConfigured() {
    return Boolean(
      EMAILJS_CONFIG.publicKey &&
      EMAILJS_CONFIG.serviceId &&
      EMAILJS_CONFIG.templateId
    );
  }

  function clearFormStatusTimer() {
    if (!formStatusTimer) return;

    window.clearTimeout(formStatusTimer);
    formStatusTimer = null;
  }

  function clearFormStatus() {
    if (!elements.formStatus) return;

    elements.formStatus.className = 'form-status';
    elements.formStatus.textContent = '';
  }

  function setFormStatus(type, message, shouldScroll = false, shouldAutoHide = false) {
    if (!elements.formStatus) return;

    clearFormStatusTimer();
    elements.formStatus.className = `form-status show ${type}`;
    elements.formStatus.textContent = message;

    if (shouldScroll) {
      elements.formStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (shouldAutoHide) {
      formStatusTimer = window.setTimeout(() => {
        clearFormStatus();
        formStatusTimer = null;
      }, FORM_STATUS_DURATION);
    }
  }
  function clearNewsletterStatusTimer() {
    if (!newsletterStatusTimer) return;

    window.clearTimeout(newsletterStatusTimer);
    newsletterStatusTimer = null;
  }

  function clearNewsletterStatus() {
    if (!elements.newsletterStatus) return;

    elements.newsletterStatus.className = 'newsletter-status';
    elements.newsletterStatus.textContent = '';
  }

  function setNewsletterStatus(type, message, shouldAutoHide = false) {
    if (!elements.newsletterStatus) return;

    clearNewsletterStatusTimer();
    elements.newsletterStatus.className = `newsletter-status show ${type}`;
    elements.newsletterStatus.textContent = message;

    if (shouldAutoHide) {
      newsletterStatusTimer = window.setTimeout(() => {
        clearNewsletterStatus();
        newsletterStatusTimer = null;
      }, FORM_STATUS_DURATION);
    }
  }

  function setNewsletterSubmitState(isLoading) {
    if (!elements.newsletterSubmitBtn) return;

    elements.newsletterSubmitBtn.disabled = isLoading;
    elements.newsletterSubmitBtn.textContent = isLoading ? 'Inscription...' : 'S’inscrire';
  }


  function getSubmitButtonLabel() {
    const selectedNeed = elements.needSelect?.value || '';

    if (isFormationNeed(selectedNeed)) return 'Réservez votre place';
    if (isPartnershipNeed(selectedNeed)) return 'Discuter d’un partenariat';

    return 'Demander une consultation';
  }

  function updateSubmitButtonLabel() {
    if (!elements.submitBtn || elements.submitBtn.disabled) return;

    elements.submitBtn.textContent = getSubmitButtonLabel();
  }

  function setSubmitState(isLoading) {
    if (!elements.submitBtn) return;
    elements.submitBtn.disabled = isLoading;
    elements.submitBtn.textContent = isLoading ? 'Envoi en cours...' : getSubmitButtonLabel();
  }

  function isFormationNeed(value) {
    if (!value) return false;

    return courses.some((course) => {
      const courseNeed = course.need || `Cours en ligne - ${course.title}`;
      return value === courseNeed;
    }) || /formation|cours en ligne/i.test(value);
  }

  function isPartnershipNeed(value) {
    if (!value) return false;

    return value === partnershipNeed || /partenariat/i.test(value);
  }

  function updateMessageFieldVisibility() {
    if (!elements.messageField || !elements.messageInput || !elements.needSelect) return;

    const isFormation = isFormationNeed(elements.needSelect.value);
    elements.messageField.classList.toggle('message-field-hidden', isFormation);
    elements.messageInput.required = !isFormation;
    elements.messageInput.disabled = isFormation;

    if (isFormation) {
      elements.messageInput.value = '';
    }

    updateSubmitButtonLabel();
  }

  async function storeLead(payload) {
    await storeLeadRequest(EMAILJS_CONFIG, payload);
  }

  function setupScrollReveal(items = document.querySelectorAll('.reveal')) {
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

  async function renderHomeArticles() {
    if (!elements.homeArticlesGrid) return;

    try {
      const articles = await getPublishedArticles();
      renderArticleCards({ container: elements.homeArticlesGrid, articles: articles.slice(0, 3) });
      setupScrollReveal(elements.homeArticlesGrid.querySelectorAll('.reveal'));
    } catch (error) {
      logClientError('actualités accueil', error);
      renderArticleCards({ container: elements.homeArticlesGrid, articles: [], emptyMessage: getSafeErrorMessage('home-articles', error) });
    }
  }

  function populateSelect() {
    if (!elements.needSelect) return;

    const serviceOptions = services
      .map((service) => `<option value="${escapeHtml(service.title)}">${escapeHtml(service.title)}</option>`)
      .join('');

    const courseOptions = courses
      .map((course) => `<option value="${escapeHtml(course.need || `Cours en ligne - ${course.title}`)}">${escapeHtml(course.need || `Cours en ligne - ${course.title}`)}</option>`)
      .join('');

    const partnershipOption = `<option value="${partnershipNeed}">${partnershipNeed}</option>`;

    elements.needSelect.innerHTML = `<option value="" disabled selected>Sélectionnez un type de projet ou formation</option>${serviceOptions}${partnershipOption}${courseOptions}`;
    updateMessageFieldVisibility();
  }

  function normalizeRequestText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, '')
      .trim();
  }

  function findMatchingNeedOption(demande) {
    if (!elements.needSelect || !demande) return null;

    const aliases = demandeMap[demande] || [demande];
    const normalizedAliases = aliases.map(normalizeRequestText);
    const options = Array.from(elements.needSelect.options || []);

    return options.find((option) => {
      const optionValue = normalizeRequestText(option.value);
      const optionText = normalizeRequestText(option.textContent);

      return normalizedAliases.some((alias) => (
        optionValue.includes(alias) ||
        optionText.includes(alias) ||
        alias.includes(optionValue) ||
        alias.includes(optionText)
      ));
    });
  }

  function selectNeedValue(value) {
    if (!elements.needSelect || !value) return;

    if (![...elements.needSelect.options].some((option) => option.value === value)) {
      elements.needSelect.add(new Option(value, value));
    }

    elements.needSelect.value = value;
    elements.needSelect.dispatchEvent(new Event('change', { bubbles: true }));
    updateMessageFieldVisibility();
  }


  function selectNeedFromExternalLink() {
    if (!elements.needSelect) return;

    const requestedNeed = new URLSearchParams(window.location.search).get('need');
    if (!requestedNeed) return;

    selectNeedValue(requestedNeed);
  }

  function prefillContactRequest() {
    if (!elements.needSelect) return;

    const demande = new URLSearchParams(window.location.search).get('demande');
    if (!demande) return;

    const matchedOption = findMatchingNeedOption(demande);
    if (!matchedOption) return;

    selectNeedValue(matchedOption.value);
  }

  function scrollToContactForm() {
    const formTarget = document.getElementById('contact-form') || elements.form;
    if (!formTarget) return;

    const headerOffset = 90;
    const y = formTarget.getBoundingClientRect().top + window.scrollY - headerOffset;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
      top: y,
      behavior: prefersReducedMotion ? 'auto' : 'smooth'
    });
  }

  function setupContactIntentScroll() {
    const params = new URLSearchParams(window.location.search);
    const hasContactIntent = window.location.hash === '#contact-form' || params.has('demande');

    if (hasContactIntent) {
      window.setTimeout(scrollToContactForm, 250);
    }
  }

  function getVisibleCourseCount() {
    if (window.innerWidth <= 620) return 1;
    if (window.innerWidth <= 900) return 2;
    return 3;
  }

  function updateCourseCarousel() {
    if (!elements.courseGrid) return;

    const visible = getVisibleCourseCount();
    const maxIndex = Math.max(0, featuredCourses.length - visible);

    if (courseIndex > maxIndex) courseIndex = maxIndex;

    const gap = 18;
    elements.courseGrid.style.transform = `translateX(calc(-${courseIndex} * ((100% - ${(visible - 1) * gap}px) / ${visible} + ${gap}px)))`;

    if (elements.coursePrev) elements.coursePrev.disabled = courseIndex === 0;
    if (elements.courseNext) elements.courseNext.disabled = courseIndex === maxIndex;
    updateCourseDots(maxIndex);
  }

  function updateCourseDots(maxIndex = Math.max(0, featuredCourses.length - getVisibleCourseCount())) {
    if (!elements.courseDots) return;

    const pages = maxIndex + 1;
    if (elements.courseDots.children.length !== pages) {
      elements.courseDots.innerHTML = Array.from({ length: pages }, (_, index) => `
        <button class="course-dot" type="button" aria-label="Afficher les formations ${index + 1}" data-course-index="${index}"></button>
      `).join('');
    }

    elements.courseDots.querySelectorAll('.course-dot').forEach((dot, index) => {
      const isActive = index === courseIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  function moveCourseCarousel(direction) {
    const visible = getVisibleCourseCount();
    const maxIndex = Math.max(0, featuredCourses.length - visible);
    courseIndex = Math.min(Math.max(courseIndex + direction, 0), maxIndex);
    updateCourseCarousel();
  }

  function updateTestimonialCarousel() {
    if (!elements.testimonialTrack) return;
    testimonialIndex = clampCarouselIndex(testimonialIndex, testimonials.length);
    elements.testimonialTrack.style.transform = `translateX(-${testimonialIndex * 100}%)`;
    updateTestimonialDots();
  }

  function updateTestimonialDots() {
    if (!elements.testimonialDots) return;

    elements.testimonialDots.querySelectorAll('.testimonial-dot').forEach((dot, index) => {
      const isActive = index === testimonialIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  function goToTestimonial(index) {
    testimonialIndex = clampCarouselIndex(index, testimonials.length);
    updateTestimonialCarousel();
  }

  function goNextTestimonial() {
    testimonialIndex = (testimonialIndex + 1) % testimonials.length;
    updateTestimonialCarousel();
  }

  function goPrevTestimonial() {
    testimonialIndex = (testimonialIndex - 1 + testimonials.length) % testimonials.length;
    updateTestimonialCarousel();
  }

  function startTestimonialCarousel() {
    if (testimonialTimer || testimonials.length <= 1) return;
    testimonialTimer = window.setInterval(goNextTestimonial, 5000);
  }

  function stopTestimonialCarousel() {
    if (!testimonialTimer) return;
    window.clearInterval(testimonialTimer);
    testimonialTimer = null;
  }

  function isMobilePartnershipCarousel() {
    return window.matchMedia('(max-width: 620px)').matches;
  }

  function getPartnershipSlideCount() {
    if (!elements.partnershipTrack) return 0;
    return elements.partnershipTrack.querySelectorAll('.partnership-card:not([aria-hidden="true"])').length;
  }

  function updatePartnershipDots(slideCount = getPartnershipSlideCount()) {
    if (!elements.partnershipDots) return;

    const dots = elements.partnershipDots.querySelectorAll('.partnership-dot');
    dots.forEach((dot, index) => {
      const isActive = index === partnershipIndex && index < slideCount;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      dot.disabled = index >= slideCount;
    });
  }

  function updatePartnershipCarousel() {
    if (!elements.partnershipTrack) return;

    const slideCount = getPartnershipSlideCount();

    if (!isMobilePartnershipCarousel()) {
      partnershipIndex = 0;
      elements.partnershipTrack.style.transform = '';
      updatePartnershipDots(slideCount);
      return;
    }

    if (!slideCount) return;

    partnershipIndex = clampCarouselIndex(partnershipIndex, slideCount);
    elements.partnershipTrack.style.transform = `translateX(-${partnershipIndex * 100}%)`;
    updatePartnershipDots(slideCount);
  }

  function goNextPartnership() {
    const slideCount = getPartnershipSlideCount();
    if (!slideCount) return;
    partnershipIndex = (partnershipIndex + 1) % slideCount;
    updatePartnershipCarousel();
  }


  function startPartnershipCarousel() {
    if (partnershipTimer || !isMobilePartnershipCarousel() || getPartnershipSlideCount() <= 1) return;
    partnershipTimer = window.setInterval(goNextPartnership, 5500);
  }

  function stopPartnershipCarousel() {
    if (!partnershipTimer) return;
    window.clearInterval(partnershipTimer);
    partnershipTimer = null;
  }

  function scheduleCarouselResizeUpdate() {
    if (resizeFrame) return;

    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      updateCourseCarousel();
      stopPartnershipCarousel();
      updatePartnershipCarousel();
      startPartnershipCarousel();
    });
  }

  function setupCourseCarousel() {
    if (!elements.courseGrid || !elements.coursePrev || !elements.courseNext) return;

    elements.coursePrev.addEventListener('click', () => moveCourseCarousel(-1));
    elements.courseNext.addEventListener('click', () => moveCourseCarousel(1));

    if (elements.courseDots) {
      elements.courseDots.addEventListener('click', (event) => {
        const dot = event.target.closest('[data-course-index]');
        if (!dot) return;

        courseIndex = Number(dot.dataset.courseIndex);
        updateCourseCarousel();
      });
    }

    updateCourseCarousel();
  }

  function setupTestimonialCarousel() {
    if (!elements.testimonialTrack || !elements.prevBtn || !elements.nextBtn) return;

    if (elements.testimonialDots) {
      elements.testimonialDots.addEventListener('click', (event) => {
        const dot = event.target.closest('.testimonial-dot');
        if (!dot) return;

        stopTestimonialCarousel();
        goToTestimonial(Number(dot.dataset.testimonialIndex));
        startTestimonialCarousel();
      });
    }

    elements.nextBtn.addEventListener('click', () => {
      stopTestimonialCarousel();
      goNextTestimonial();
      startTestimonialCarousel();
    });

    elements.prevBtn.addEventListener('click', () => {
      stopTestimonialCarousel();
      goPrevTestimonial();
      startTestimonialCarousel();
    });

    const carousel = elements.testimonialTrack.closest('.testimonial-carousel');
    if (carousel) {
      carousel.addEventListener('mouseenter', stopTestimonialCarousel);
      carousel.addEventListener('mouseleave', startTestimonialCarousel);
      carousel.addEventListener('focusin', stopTestimonialCarousel);
      carousel.addEventListener('focusout', startTestimonialCarousel);
    }

    startTestimonialCarousel();
  }

  function setupPartnershipCarousel() {
    if (!elements.partnershipTrack || !elements.partnershipNext) return;

    elements.partnershipNext.addEventListener('click', () => {
      stopPartnershipCarousel();
      goNextPartnership();
      startPartnershipCarousel();
    });

    if (elements.partnershipDots) {
      elements.partnershipDots.querySelectorAll('.partnership-dot').forEach((dot, index) => {
        dot.addEventListener('click', () => {
          stopPartnershipCarousel();
          partnershipIndex = index;
          updatePartnershipCarousel();
          startPartnershipCarousel();
        });
      });
    }

    const carousel = elements.partnershipTrack.closest('.partnership-carousel');
    if (carousel) {
      carousel.addEventListener('mouseenter', stopPartnershipCarousel);
      carousel.addEventListener('mouseleave', startPartnershipCarousel);
      carousel.addEventListener('focusin', stopPartnershipCarousel);
      carousel.addEventListener('focusout', startPartnershipCarousel);
    }

    updatePartnershipCarousel();
    startPartnershipCarousel();
  }

  function setupEvents() {
    if (elements.filters) {
      elements.filters.addEventListener('click', (event) => {
        const button = event.target.closest('.filter-btn');
        if (!button) return;

        document.querySelectorAll('.filter-btn').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        renderServices({ serviceGrid: elements.serviceGrid, services: featuredServices, category: button.dataset.category, setupScrollReveal });
      });
    }

    document.addEventListener('click', (event) => {
      const link = event.target.closest('[data-need]');
      if (!link) return;
      if (elements.needSelect) {
        selectNeedValue(link.dataset.need);
      }

      if (link.dataset.contactCard === 'true') {
        window.location.hash = 'contact';
      }
    });

    function setMobileMenuState(isOpen) {
      if (!elements.navLinks || !elements.menuBtn) return;

      elements.navLinks.classList.toggle('open', isOpen);
      elements.menuBtn.setAttribute('aria-expanded', String(isOpen));
      elements.menuBtn.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    }

    if (elements.brandHome) {
      elements.brandHome.addEventListener('click', (event) => {
        event.preventDefault();
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? 'auto' : 'smooth'
        });

        if (window.location.hash !== '#top') {
          window.history.pushState(null, '', '#top');
        }

        setMobileMenuState(false);
      });
    }

    if (elements.menuBtn && elements.navLinks) {
      elements.menuBtn.addEventListener('click', () => {
        const isOpen = !elements.navLinks.classList.contains('open');
        setMobileMenuState(isOpen);
      });

      elements.navLinks.addEventListener('click', (event) => {
        if (!event.target.closest('a')) return;
        setMobileMenuState(false);
      });
    }

    if (elements.needSelect) {
      elements.needSelect.addEventListener('change', updateMessageFieldVisibility);
    }

    if (elements.courseGrid || elements.partnershipTrack) {
      window.addEventListener('resize', scheduleCarouselResizeUpdate, { passive: true });
    }

    if (elements.form) {
      elements.form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const name = elements.nameInput?.value.trim() || '';
        const email = elements.emailInput?.value.trim() || '';
        const phone = sanitizePhone(elements.phoneInput?.value || '');
        const need = elements.needSelect?.value || '';
        const isFormationRequest = isFormationNeed(need);
        const message = isFormationRequest
          ? 'Demande liée à une formation sélectionnée.'
          : elements.messageInput?.value.trim() || '';
        const consent = elements.consentInput?.checked || false;
        const website = elements.honeypotInput?.value.trim() || '';

        if (formResetTimer) {
          window.clearTimeout(formResetTimer);
          formResetTimer = null;
        }

        clearFormStatusTimer();

        if (website) return;

        if (!name || !email || !phone || !need || (!isFormationRequest && !message) || !consent) {
          setFormStatus('error', 'Veuillez compléter les champs obligatoires avant d’envoyer.');
          return;
        }

        if (!isEmailValid(email)) {
          setFormStatus('error', 'Veuillez entrer une adresse email valide.');
          return;
        }

        if (!window.emailjs || !isEmailJsConfigured()) {
          setFormStatus('error', FORM_ERROR_MESSAGE);
          return;
        }

        const payload = {
          from_name: name,
          from_email: email,
          phone,
          need,
          message,
          consent: consent ? 'Oui' : 'Non',
          source: 'Site Agri-Tech',
          SOURCE: 'Formulaire de contact',
          TYPE_CONTACT: 'Contact',
          date: new Date().toISOString()
        };

        try {
          setSubmitState(true);
          setFormStatus('success', 'Envoi de votre demande en cours...');

          await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, payload);

          if (EMAILJS_CONFIG.autoReplyTemplateId) {
            await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.autoReplyTemplateId, payload);
          }

          await storeLead(payload);

          setFormStatus('success', FORM_SUCCESS_MESSAGE, true, true);

          formResetTimer = window.setTimeout(() => {
            elements.form.reset();
            updateMessageFieldVisibility();
            formResetTimer = null;
          }, 500);
        } catch (error) {
          logClientError('formulaire contact', error);
          setFormStatus('error', getSafeErrorMessage('email', error), true, true);
        } finally {
          setSubmitState(false);
        }
      });
    }


    if (elements.newsletterForm) {
      elements.newsletterForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = elements.newsletterEmailInput?.value.trim() || '';
        clearNewsletterStatusTimer();

        if (!email) {
          setNewsletterStatus('error', 'Veuillez entrer votre adresse email.');
          return;
        }

        if (!isEmailValid(email)) {
          setNewsletterStatus('error', 'Veuillez entrer une adresse email valide.');
          return;
        }

        if (!window.emailjs || !isEmailJsConfigured()) {
          setNewsletterStatus('error', NEWSLETTER_ERROR_MESSAGE);
          return;
        }

        const payload = {
          from_name: 'Abonné newsletter',
          from_email: email,
          phone: '',
          need: 'Newsletter',
          message: 'Inscription à la newsletter depuis le footer.',
          consent: 'Oui',
          source: 'Footer newsletter',
          SOURCE: 'Footer newsletter',
          TYPE_CONTACT: 'Newsletter',
          date: new Date().toISOString()
        };

        try {
          setNewsletterSubmitState(true);
          setNewsletterStatus('success', 'Inscription en cours...');

          await window.emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, payload);
          await storeLead(payload);

          setNewsletterStatus('success', NEWSLETTER_SUCCESS_MESSAGE, true);
          elements.newsletterForm.reset();
        } catch (error) {
          logClientError('newsletter', error);
          setNewsletterStatus('error', getSafeErrorMessage('newsletter', error), true);
        } finally {
          setNewsletterSubmitState(false);
        }
      });
    }
  }

  function runSmokeTests() {
    console.assert(services.length === 12, 'Test échoué : 12 services attendus.');
    console.assert(courses.length >= 3, 'Test échoué : au moins 3 cours attendus.');
    console.assert(testimonials.length === 3, 'Test échoué : 3 témoignages attendus.');
    console.assert(services.every((service) => service.image.startsWith('assets/images/')), 'Test échoué : images services locales attendues.');
    console.assert(courses.every((course) => course.image.startsWith('assets/images/')), 'Test échoué : images formations locales attendues.');
    console.assert(testimonials.every((testimonial) => testimonial.image.startsWith('assets/images/')), 'Test échoué : images témoignages locales attendues.');
    console.assert(escapeHtml('<test>') === '&lt;test&gt;', 'Test échoué : protection HTML.');
    console.assert(isEmailValid('test@example.com'), 'Test échoué : validation email.');
    console.assert(typeof storeLead === 'function', 'Test échoué : fonction stockage lead manquante.');
    console.assert(elements.newsletterForm === null || elements.newsletterEmailInput !== null, 'Test échoué : email newsletter manquant.');
    console.assert(typeof updateCourseCarousel === 'function', 'Test échoué : carousel formations manquant.');
    console.assert(elements.testimonialDots === null || elements.testimonialDots.children.length === testimonials.length, 'Test échoué : indicateurs témoignages manquants.');
    console.assert(typeof updatePartnershipCarousel === 'function', 'Test échoué : carousel partenariats manquant.');
    console.assert(elements.partnershipTrack === null || getPartnershipSlideCount() === 3, 'Test échoué : 3 cartes partenariats attendues.');
    console.assert(elements.brandHome === null || elements.brandHome.getAttribute('href') === '#top', 'Test échoué : le logo doit pointer vers le haut de page.');
    console.assert(elements.serviceGrid === null || elements.serviceGrid.children.length <= featuredServices.length, 'Test échoué : aperçu services attendu.');
    console.assert(elements.courseGrid === null || elements.courseGrid.children.length === featuredCourses.length, 'Test échoué : aperçu formations attendu.');
    console.assert(elements.needSelect === null || [...elements.needSelect.options].some((option) => option.value === partnershipNeed), 'Test échoué : option Partenariat manquante.');
    if (elements.needSelect && elements.submitBtn) {
      const originalNeed = elements.needSelect.value;
      elements.needSelect.value = partnershipNeed;
      console.assert(getSubmitButtonLabel() === 'Discuter d’un partenariat', 'Test échoué : libellé partenariat attendu.');
      elements.needSelect.value = services[0].title;
      console.assert(getSubmitButtonLabel() === 'Demander une consultation', 'Test échoué : libellé consultation attendu.');
      elements.needSelect.value = originalNeed;
      updateMessageFieldVisibility();
    }
  }

  renderFilters({ filters: elements.filters, categories });
  renderServices({ serviceGrid: elements.serviceGrid, services: featuredServices, setupScrollReveal });
  renderCourses({ courseGrid: elements.courseGrid, courses: featuredCourses, setupScrollReveal, updateCourseCarousel });
  renderTestimonials({ testimonialTrack: elements.testimonialTrack, testimonialDots: elements.testimonialDots, testimonials, updateTestimonialCarousel });
  renderHomeArticles();
  populateSelect();
  selectNeedFromExternalLink();
  prefillContactRequest();
  setupContactIntentScroll();
  setupEvents();
  initFloatingActions();
  setupCourseCarousel();
  setupTestimonialCarousel();
  setupPartnershipCarousel();
  setupScrollReveal();
  runSmokeTests();
});
