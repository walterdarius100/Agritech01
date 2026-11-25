import { renderProjects } from './components/render-projects.js';
import { FORM_ERROR_MESSAGE, FORM_STATUS_DURATION, FORM_SUCCESS_MESSAGE, FORM_UNCERTAIN_MESSAGE } from './config.js';
import { PARTNERSHIP_NEED, contactRequestType } from './config/contact-needs.js';
import { services } from './data/services.js';
import { courses } from './data/formations.js';
import { testimonials } from './data/testimonials.js';
import { renderCourses } from './components/render-formations.js';
import { renderServices } from './components/render-services.js';
import { renderTestimonials } from './components/render-testimonials.js';
import { getPublishedArticles, renderArticleCards } from './components/render-articles.js';
import { clampCarouselIndex } from './components/carousel.js';
import { createContactSubmission } from './components/contact-form.js';
import { initMobileMenu } from './pages/page-utils.js';
import { escapeHtml, sanitizePhone } from './utils/sanitize.js';
import { isEmailValid } from './utils/validation.js';
import { getSafeErrorMessage, logClientError } from './utils/error-messages.js';

// Agri-Tech application bootstrap.
document.addEventListener('DOMContentLoaded', function initAgriTechSite() {
  let submissionStorage;
  try {
    submissionStorage = window.sessionStorage;
  } catch {
    // Submission keys can also be kept in memory.
  }
  const submitContactRequest = createContactSubmission({ storage: submissionStorage });
  let submittingContact = false;
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
    needSelect: document.querySelector('#need'),
    form: document.querySelector('#leadForm'),
    messageField: document.querySelector('#messageField'),
    messageInput: document.querySelector('#message'),
    messageCounter: document.querySelector('#messageCounter'),
    submitBtn: document.querySelector('#submitBtn'),
    formStatus: document.querySelector('#formStatus'),
    nameInput: document.querySelector('#name'),
    emailInput: document.querySelector('#email'),
    phoneInput: document.querySelector('#phone'),
    consentInput: document.querySelector('#consent'),
    honeypotInput: document.querySelector('#website'),
    homeArticlesGrid: document.querySelector('#homeArticlesGrid')
  };

  const partnershipNeed = PARTNERSHIP_NEED;
  const featuredServices = services.slice(0, 3);
  const featuredCourses = courses.slice(0, 3);
  let testimonialIndex = 0;
  let testimonialTimer = null;
  let partnershipIndex = 0;
  let partnershipTimer = null;
  let courseIndex = 0;
  let resizeFrame = null;
  let formStatusTimer = null;
  const messageMaxLength = Number(elements.messageInput?.getAttribute('maxlength')) || 1200;


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
    return contactRequestType(value) === 'formation';
  }

  function isPartnershipNeed(value) {
    return contactRequestType(value) === 'partenariat';
  }

  function updateMessageCounter() {
    if (!elements.messageInput || !elements.messageCounter) return;

    const currentLength = elements.messageInput.value.length;
    const isNearLimit = currentLength >= Math.floor(messageMaxLength * 0.85);
    const isLimitReached = currentLength >= messageMaxLength;

    elements.messageCounter.textContent = isLimitReached
      ? `${currentLength} / ${messageMaxLength} caractères · Limite atteinte. Merci de résumer votre demande.`
      : `${currentLength} / ${messageMaxLength} caractères`;
    elements.messageCounter.classList.toggle('is-warning', isNearLimit && !isLimitReached);
    elements.messageCounter.classList.toggle('is-limit', isLimitReached);
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

    updateMessageCounter();
    updateSubmitButtonLabel();
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


  function selectNeedFromExternalLink() {
    if (!elements.needSelect) return;

    const requestedNeed = new URLSearchParams(window.location.search).get('need');
    if (!contactRequestType(requestedNeed)) return;

    if (![...elements.needSelect.options].some((option) => option.value === requestedNeed)) {
      elements.needSelect.add(new Option(requestedNeed, requestedNeed));
    }

    elements.needSelect.value = requestedNeed;
    updateMessageFieldVisibility();
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
    document.addEventListener('click', (event) => {
      const link = event.target.closest('[data-need]');
      if (!link) return;
      if (elements.needSelect) {
        if (link.dataset.need && ![...elements.needSelect.options].some((option) => option.value === link.dataset.need)) {
          elements.needSelect.add(new Option(link.dataset.need, link.dataset.need));
        }
        elements.needSelect.value = link.dataset.need;
        updateMessageFieldVisibility();
      }

      if (link.dataset.contactCard === 'true') {
        window.location.hash = 'contact';
      }
    });

    if (elements.needSelect) {
      elements.needSelect.addEventListener('change', updateMessageFieldVisibility);
    }

    if (elements.messageInput) {
      elements.messageInput.addEventListener('input', updateMessageCounter);
      updateMessageCounter();
    }

    if (elements.courseGrid || elements.partnershipTrack) {
      window.addEventListener('resize', scheduleCarouselResizeUpdate, { passive: true });
    }

    if (elements.form) {
      elements.form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submittingContact) return;

        const name = elements.nameInput?.value.trim() || '';
        const email = elements.emailInput?.value.trim() || '';
        const phone = sanitizePhone(elements.phoneInput?.value || '');
        const need = elements.needSelect?.value || '';
        const isFormationRequest = isFormationNeed(need);
        const message = isFormationRequest
          ? ''
          : elements.messageInput?.value.trim() || '';
        const consent = elements.consentInput?.checked || false;
        const website = elements.honeypotInput?.value.trim() || '';

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

        try {
          submittingContact = true;
          setSubmitState(true);
          setFormStatus('success', 'Envoi de votre demande en cours...');

          const result = await submitContactRequest({ name, email, phone, need, message, consent, website });
          if (result !== 'recorded') {
            setFormStatus('error', result === 'rejected' ? FORM_ERROR_MESSAGE : FORM_UNCERTAIN_MESSAGE, true);
            return;
          }

          elements.form.reset();
          updateMessageFieldVisibility();
          setFormStatus('success', FORM_SUCCESS_MESSAGE, true, true);
        } catch {
          setFormStatus('error', FORM_UNCERTAIN_MESSAGE, true);
        } finally {
          submittingContact = false;
          setSubmitState(false);
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
    console.assert(elements.messageInput === null || elements.messageInput.name === 'message', 'Test échoué : le nom du champ message doit rester inchangé.');
    console.assert(elements.messageInput === null || Number(elements.messageInput.getAttribute('maxlength')) === messageMaxLength, 'Test échoué : limite du champ message inattendue.');
    console.assert(elements.messageCounter === null || elements.messageCounter.textContent.includes(`/ ${messageMaxLength}`), 'Test échoué : compteur message initial inattendu.');
    console.assert(typeof updateCourseCarousel === 'function', 'Test échoué : carousel formations manquant.');
    console.assert(elements.testimonialDots === null || elements.testimonialDots.children.length === testimonials.length, 'Test échoué : indicateurs témoignages manquants.');
    console.assert(typeof updatePartnershipCarousel === 'function', 'Test échoué : carousel partenariats manquant.');
    console.assert(elements.partnershipTrack === null || getPartnershipSlideCount() === 3, 'Test échoué : 3 cartes partenariats attendues.');
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

  renderProjects(document.querySelector('#homeProjectGrid'), document.querySelector('#homeProjectsPending'));
  renderServices({ serviceGrid: elements.serviceGrid, services: featuredServices, setupScrollReveal });
  renderCourses({ courseGrid: elements.courseGrid, courses: featuredCourses, setupScrollReveal, updateCourseCarousel });
  renderTestimonials({ testimonialTrack: elements.testimonialTrack, testimonialDots: elements.testimonialDots, testimonials, updateTestimonialCarousel });
  renderHomeArticles();
  populateSelect();
  selectNeedFromExternalLink();
  setupEvents();
  initMobileMenu();
  setupCourseCarousel();
  setupTestimonialCarousel();
  setupPartnershipCarousel();
  setupScrollReveal();
  runSmokeTests();
});
