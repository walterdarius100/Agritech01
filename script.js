// Agri-Tech - script.js
'use strict';

document.addEventListener('DOMContentLoaded', function initAgriTechSite() {
  const EMAILJS_CONFIG = {
    publicKey: 'FIM6Dgp1FXsfD9fJf',
    serviceId: 'service_z856n3l',
    templateId: 'template_pzsnmea',
    autoReplyTemplateId: '',
    sheetEndpoint: 'https://script.google.com/macros/s/AKfycbw6LvUrYSGt7pyWOK9E4UY_bJpAP9FbhyvfSK5clxBfDSQUPuBVa750vS5y59ybFApJ/exec'
  };

  if (window.emailjs) {
    window.emailjs.init({
      publicKey: EMAILJS_CONFIG.publicKey,
      blockHeadless: true,
      limitRate: { id: 'agritech-contact-form', throttle: 10000 }
    });
  }

  const services = [
    { title: 'Poulet de chair', category: 'Élevage', image: 'assets/images/poulet-chair.jpg', text: 'Conception de poulailler, plan de production, équipements et accompagnement technique.' },
    { title: 'Poule pondeuse', category: 'Élevage', image: 'assets/images/poule-pondeuse.jpg', text: 'Mise en place d’unités de ponte, suivi sanitaire, alimentation et rentabilité.' },
    { title: 'Incubateur / Écloserie', category: 'Technologie', image: 'assets/images/incubateur.jpg', text: 'Fabrication et accompagnement autour des incubateurs pour production de poussins.' },
    { title: 'Cuniculture', category: 'Élevage', image: 'assets/images/cuniculture.jpg', text: 'Clapiers modernes, formation, équipements et installation de fermes cunicoles.' },
    { title: 'Porcherie', category: 'Élevage', image: 'assets/images/porcherie.jpg', text: 'Conception de porcherie, hygiène, alimentation, reproduction et suivi de croissance.' },
    { title: 'Pépinière', category: 'Production', image: 'assets/images/pepiniere.jpg', text: 'Implantation de pépinières, choix de semences, matériel et formation pratique.' },
    { title: 'Apiculture', category: 'Élevage', image: 'assets/images/apiculture.jpg', text: 'Conception de rucher, installation de ruches, formation et valorisation du miel.' },
    { title: 'Pisciculture', category: 'Élevage', image: 'assets/images/pisciculture.jpg', text: 'Élevage de poissons, bassin, alimentation, densité et plan de production.' },
    { title: 'Gabionnage', category: 'Infrastructure', image: 'assets/images/gabionnage.jpg', text: 'Solutions de protection, stabilisation de terrain et aménagement rural.' },
    { title: 'Irrigation', category: 'Infrastructure', image: 'assets/images/irrigation.jpg', text: 'Systèmes d’irrigation adaptés aux cultures, au terrain et au budget disponible.' },
    { title: 'Biogaz', category: 'Technologie', image: 'assets/images/biogaz.jpg', text: 'Valorisation des déchets organiques pour produire énergie et fertilisants.' },
    { title: 'Clôture métallique', category: 'Infrastructure', image: 'assets/images/cloture-metallique.jpg', text: 'Clôtures agricoles pour sécuriser les exploitations, animaux et équipements.' }
  ];

  const courses = [
    { title: 'Cuniculture rentable (de 0 à 50 000 HT)', image: 'assets/images/formation-cuniculture.jpg', level: 'Débutant', duration: '4 modules', status: 'Disponible', price: 'Accès immédiat après validation', text: 'Apprenez à lancer un élevage de lapins rentable avec une méthode claire étape par étape.', bonus: 'Support WhatsApp 7 jours' },
    { title: 'Poulet de chair : produire et vendre efficacement', image: 'assets/images/formation-poulet.jpg', level: 'Intermédiaire', duration: '5 modules', status: 'Disponible', price: 'Accès immédiat après validation', text: 'Maîtrisez tout le cycle de production : installation, alimentation, santé et vente.', bonus: 'Plan de production inclus' },
    { title: 'Apiculture moderne simplifiée', image: 'assets/images/formation-apiculture.jpg', level: 'Débutant', duration: '3 modules', status: 'Bientôt disponible', price: 'Préinscription ouverte', text: 'Comprenez les bases pour démarrer un rucher et produire du miel.', bonus: 'Liste du matériel fournie' },
    { title: 'Formation en élevage de poules pondeuses', image: 'assets/images/poule-pondeuse.jpg', level: 'Élevage', duration: '4 modules', status: 'Bientôt disponible', price: 'Préinscription ouverte', text: 'Apprenez les bases essentielles pour démarrer et gérer un élevage de poules pondeuses de manière structurée et rentable.', bonus: 'Alerte au lancement', cta: 'Accéder à la formation', need: 'Formation poule pondeuse', cardLink: true },
    { title: 'Formation en pisciculture', image: 'assets/images/pisciculture.jpg', level: 'Élevage', duration: '4 modules', status: 'Bientôt disponible', price: 'Préinscription ouverte', text: 'Apprenez les bases essentielles pour démarrer et gérer un projet piscicole de manière structurée, rentable et adaptée à votre réalité.', bonus: 'Alerte au lancement', cta: 'Accéder à la formation', need: 'Formation en pisciculture', cardLink: true }
  ];

  const testimonials = [
    { name: 'Participant formation', role: 'Cuniculture', image: 'assets/images/temoignage-1.jpg', text: 'L’accompagnement m’a permis de mieux comprendre les étapes avant de lancer mon élevage. Les explications étaient claires et pratiques.' },
    { name: 'Porteur de projet', role: 'Poulet de chair', image: 'assets/images/temoignage-2.jpg', text: 'Agri-tech m’a aidé à structurer mon idée et à voir les erreurs que je devais éviter avant d’investir.' },
    { name: 'Jeune entrepreneur agricole', role: 'Projet agricole', image: 'assets/images/temoignage-3.jpg', text: 'Ce que j’ai apprécié, c’est l’approche directe : diagnostic, conseils techniques et orientation claire pour avancer.' }
  ];

  const elements = {
    serviceGrid: document.querySelector('#serviceGrid'),
    courseGrid: document.querySelector('#courseGrid'),
    coursePrev: document.querySelector('#coursePrev'),
    courseNext: document.querySelector('#courseNext'),
    testimonialTrack: document.querySelector('#testimonialTrack'),
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
    honeypotInput: document.querySelector('#website')
  };

  const partnershipNeed = 'Partenariat';
  const categories = ['Tous', ...new Set(services.map((service) => service.category))];
  let testimonialIndex = 0;
  let testimonialTimer = null;
  let partnershipIndex = 0;
  let partnershipTimer = null;
  let courseIndex = 0;
  let resizeFrame = null;
  let formResetTimer = null;
  let formStatusTimer = null;
  const FORM_STATUS_DURATION = 10000;
  const FORM_SUCCESS_MESSAGE = 'Votre demande a bien été envoyée. Notre équipe vous recontactera dans les meilleurs délais.';
  const FORM_ERROR_MESSAGE = 'Une erreur est survenue lors de l’envoi. Veuillez réessayer ou nous contacter directement.';

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getDelayClass(index) {
    if (index % 3 === 1) return 'reveal-delay-1';
    if (index % 3 === 2) return 'reveal-delay-2';
    return '';
  }

  function isEmailValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function sanitizePhone(value) {
    return String(value).replace(/[^0-9+\s-]/g, '').trim();
  }

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

  function getSubmitButtonLabel() {
    return isFormationNeed(elements.needSelect?.value || '')
      ? 'Réservez votre place'
      : 'Demander une consultation';
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
    if (!EMAILJS_CONFIG.sheetEndpoint) return;

    try {
      const formData = new URLSearchParams();

      Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, value);
      });

      await fetch(EMAILJS_CONFIG.sheetEndpoint, {
        method: 'POST',
        mode: 'no-cors',
        body: formData
      });
    } catch (error) {
      console.warn('Stockage du lead non confirmé:', error);
    }
  }

  function setupScrollReveal(items = document.querySelectorAll('.reveal')) {
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

  function renderFilters() {
    if (!elements.filters) return;
    elements.filters.innerHTML = categories
      .map((category, index) => `<button class="filter-btn ${index === 0 ? 'active' : ''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
      .join('');
  }

  function renderServices(category = 'Tous') {
    if (!elements.serviceGrid) return;
    const visibleServices = category === 'Tous' ? services : services.filter((service) => service.category === category);

    elements.serviceGrid.innerHTML = visibleServices
      .map((service, index) => `
        <article class="service-card reveal ${getDelayClass(index)}">
          <img src="${escapeHtml(service.image)}" alt="${escapeHtml(service.title)}" class="service-image" width="1200" height="800" loading="lazy" decoding="async" />
          <div class="service-content">
            <span class="tag">${escapeHtml(service.category)}</span>
            <h3>${escapeHtml(service.title)}</h3>
            <p>${escapeHtml(service.text)}</p>
            <a href="#contact" data-need="${escapeHtml(service.title)}">Demander ce service →</a>
          </div>
        </article>
      `)
      .join('');

    setupScrollReveal(elements.serviceGrid.querySelectorAll('.reveal'));
  }

  function renderCourses() {
    if (!elements.courseGrid) return;

    elements.courseGrid.innerHTML = courses
      .map((course, index) => `
        <article class="course-card reveal ${getDelayClass(index)}"${course.cardLink ? ` data-need="${escapeHtml(course.need)}" data-contact-card="true"` : ''}>
          <div class="course-header">
            <img src="${escapeHtml(course.image)}" alt="${escapeHtml(course.title)}" width="1200" height="800" loading="lazy" decoding="async" />
            <span class="course-badge">Formation</span>
          </div>
          <div class="course-body">
            <h3>${escapeHtml(course.title)}</h3>
            <p>${escapeHtml(course.text)}</p>
            <div class="course-meta">
              <span>${escapeHtml(course.level)}</span>
              <span>${escapeHtml(course.duration)}</span>
              <span>${escapeHtml(course.status)}</span>
            </div>
            <div class="course-price">${escapeHtml(course.price)}</div>
            <p class="bonus">🎁 ${escapeHtml(course.bonus)}</p>
            <a href="#contact" data-need="${escapeHtml(course.need || `Cours en ligne - ${course.title}`)}" class="btn primary full">${escapeHtml(course.cta || 'Accéder à la formation')}</a>
          </div>
        </article>
      `)
      .join('');

    setupScrollReveal(elements.courseGrid.querySelectorAll('.reveal'));
    updateCourseCarousel();
  }

  function renderTestimonials() {
    if (!elements.testimonialTrack) return;

    elements.testimonialTrack.innerHTML = testimonials
      .map((testimonial) => `
        <article class="testimonial-card">
          <img src="${escapeHtml(testimonial.image)}" alt="${escapeHtml(testimonial.name)}" class="testimonial-image" width="1200" height="800" loading="lazy" decoding="async" />
          <div class="testimonial-content">
            <div class="testimonial-author">
              <strong>${escapeHtml(testimonial.name)}</strong>
              <span>${escapeHtml(testimonial.role)}</span>
            </div>
            <div class="testimonial-stars" aria-label="5 étoiles">★★★★★</div>
            <p class="testimonial-text">${escapeHtml(testimonial.text)}</p>
          </div>
        </article>
      `)
      .join('');
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

  function getVisibleCourseCount() {
    if (window.innerWidth <= 620) return 1;
    if (window.innerWidth <= 900) return 2;
    return 3;
  }

  function updateCourseCarousel() {
    if (!elements.courseGrid) return;

    const visible = getVisibleCourseCount();
    const maxIndex = Math.max(0, courses.length - visible);

    if (courseIndex > maxIndex) courseIndex = maxIndex;

    const gap = 18;
    elements.courseGrid.style.transform = `translateX(calc(-${courseIndex} * ((100% - ${(visible - 1) * gap}px) / ${visible} + ${gap}px)))`;

    if (elements.coursePrev) elements.coursePrev.disabled = courseIndex === 0;
    if (elements.courseNext) elements.courseNext.disabled = courseIndex === maxIndex;
  }

  function moveCourseCarousel(direction) {
    const visible = getVisibleCourseCount();
    const maxIndex = Math.max(0, courses.length - visible);
    courseIndex = Math.min(Math.max(courseIndex + direction, 0), maxIndex);
    updateCourseCarousel();
  }

  function updateTestimonialCarousel() {
    if (!elements.testimonialTrack) return;
    elements.testimonialTrack.style.transform = `translateX(-${testimonialIndex * 100}%)`;
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

    partnershipIndex = Math.min(Math.max(partnershipIndex, 0), slideCount - 1);
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
    updateCourseCarousel();
  }

  function setupTestimonialCarousel() {
    if (!elements.testimonialTrack || !elements.prevBtn || !elements.nextBtn) return;

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
        renderServices(button.dataset.category);
      });
    }

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

        if (elements.navLinks && elements.menuBtn) {
          elements.navLinks.classList.remove('open');
          elements.menuBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (elements.menuBtn && elements.navLinks) {
      elements.menuBtn.addEventListener('click', () => {
        const isOpen = elements.navLinks.classList.toggle('open');
        elements.menuBtn.setAttribute('aria-expanded', String(isOpen));
      });

      elements.navLinks.addEventListener('click', (event) => {
        if (!event.target.closest('a')) return;
        elements.navLinks.classList.remove('open');
        elements.menuBtn.setAttribute('aria-expanded', 'false');
      });
    }

    if (elements.needSelect) {
      elements.needSelect.addEventListener('change', updateMessageFieldVisibility);
    }

    window.addEventListener('resize', scheduleCarouselResizeUpdate, { passive: true });

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
          setFormStatus('error', 'Veuillez remplir les champs requis et accepter d’être recontacté.');
          return;
        }

        if (!isEmailValid(email)) {
          setFormStatus('error', 'Veuillez entrer une adresse email valide.');
          return;
        }

        if (!window.emailjs || !isEmailJsConfigured()) {
          setFormStatus('error', 'EmailJS n’est pas encore configuré. Ajoutez vos identifiants dans script.js.');
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
          console.error('Erreur EmailJS:', error);
          setFormStatus('error', FORM_ERROR_MESSAGE, true, true);
        } finally {
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
    console.assert(typeof storeLead === 'function', 'Test échoué : fonction stockage lead manquante.');
    console.assert(typeof updateCourseCarousel === 'function', 'Test échoué : carousel formations manquant.');
    console.assert(typeof updatePartnershipCarousel === 'function', 'Test échoué : carousel partenariats manquant.');
    console.assert(elements.partnershipTrack === null || getPartnershipSlideCount() === 3, 'Test échoué : 3 cartes partenariats attendues.');
    console.assert(elements.brandHome === null || elements.brandHome.getAttribute('href') === '#top', 'Test échoué : le logo doit pointer vers le haut de page.');
    console.assert(elements.courseGrid === null || elements.courseGrid.children.length === courses.length, 'Test échoué : toutes les formations doivent être rendues.');
    console.assert(elements.needSelect === null || [...elements.needSelect.options].some((option) => option.value === partnershipNeed), 'Test échoué : option Partenariat manquante.');
  }

  renderFilters();
  renderServices();
  renderCourses();
  renderTestimonials();
  populateSelect();
  setupEvents();
  setupCourseCarousel();
  setupTestimonialCarousel();
  setupPartnershipCarousel();
  setupScrollReveal();
  runSmokeTests();
});
