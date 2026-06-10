(() => {
  const postsUrl = 'data/blog-posts.json';
  const categoryOrder = ['Tous', 'Actualités', 'Alertes', 'Événements', 'Marché agricole', 'Analyse Agri-tech'];
  const state = { posts: [], activeCategory: 'Tous' };

  const elements = {
    homeGrid: document.querySelector('#homeNewsGrid'),
    filters: document.querySelector('#blogFilters'),
    featured: document.querySelector('#featuredPost'),
    grid: document.querySelector('#blogGrid')
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('fr-HT', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  function sortPosts(posts) {
    return [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function coverMarkup(post, className = 'news-card-image') {
    if (post.cover) {
      return `<div class="${className}"><img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}" loading="lazy" decoding="async" /></div>`;
    }

    return `<div class="${className}"><div class="news-placeholder" aria-hidden="true"><span>🌿</span></div></div>`;
  }

  function cardMarkup(post) {
    return `
      <article class="news-card">
        ${coverMarkup(post)}
        <div class="news-card-body">
          <div class="news-meta">
            <span class="news-category">${escapeHtml(post.category)}</span>
            <span class="news-type">${escapeHtml(post.type)}</span>
            <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>
          </div>
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.excerpt)}</p>
          <a class="news-card-link" href="article.html?slug=${encodeURIComponent(post.slug)}">Lire l’article →</a>
        </div>
      </article>`;
  }

  function renderHome(posts) {
    if (!elements.homeGrid) return;
    const latest = sortPosts(posts).slice(0, 3);

    elements.homeGrid.innerHTML = latest.length
      ? latest.map(cardMarkup).join('')
      : '<div class="empty-state">Aucune actualité agricole n’est disponible pour le moment.</div>';
  }

  function renderFilters(posts) {
    if (!elements.filters) return;
    const categories = categoryOrder.filter((category) => category === 'Tous' || posts.some((post) => post.category === category));

    elements.filters.innerHTML = categories
      .map((category) => `<button class="blog-filter-btn ${category === state.activeCategory ? 'active' : ''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`)
      .join('');
  }

  function renderFeatured(posts) {
    if (!elements.featured) return;
    const featuredPost = sortPosts(posts).find((post) => post.featured);

    if (!featuredPost) {
      elements.featured.innerHTML = '';
      elements.featured.hidden = true;
      return;
    }

    elements.featured.hidden = false;
    elements.featured.innerHTML = `
      ${coverMarkup(featuredPost, 'featured-news-image')}
      <div class="featured-news-content">
        <div class="news-meta">
          <span class="news-category">À la une</span>
          <span class="news-type">${escapeHtml(featuredPost.type)}</span>
          <time datetime="${escapeHtml(featuredPost.date)}">${escapeHtml(formatDate(featuredPost.date))}</time>
        </div>
        <h2>${escapeHtml(featuredPost.title)}</h2>
        <p>${escapeHtml(featuredPost.excerpt)}</p>
        <a href="article.html?slug=${encodeURIComponent(featuredPost.slug)}" class="btn primary">Lire l’article</a>
      </div>`;
  }

  function renderGrid(posts) {
    if (!elements.grid) return;
    const visiblePosts = state.activeCategory === 'Tous'
      ? sortPosts(posts)
      : sortPosts(posts).filter((post) => post.category === state.activeCategory);

    elements.grid.innerHTML = visiblePosts.length
      ? visiblePosts.map(cardMarkup).join('')
      : '<div class="empty-state">Aucune publication n’est disponible dans cette catégorie pour le moment.</div>';
  }

  function setupFilters() {
    if (!elements.filters) return;
    elements.filters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      state.activeCategory = button.dataset.category;
      renderFilters(state.posts);
      renderGrid(state.posts);
    });
  }

  async function loadPosts() {
    const shouldLoad = elements.homeGrid || elements.grid || elements.featured || elements.filters;
    if (!shouldLoad) return;

    try {
      const response = await fetch(postsUrl);
      if (!response.ok) throw new Error(`Chargement impossible (${response.status})`);
      const posts = await response.json();
      state.posts = Array.isArray(posts) ? posts : [];
      renderHome(state.posts);
      renderFilters(state.posts);
      renderFeatured(state.posts);
      renderGrid(state.posts);
    } catch (error) {
      console.error('Erreur de chargement des actualités:', error);
      const message = '<div class="empty-state">Les actualités agricoles ne peuvent pas être chargées pour le moment.</div>';
      if (elements.homeGrid) elements.homeGrid.innerHTML = message;
      if (elements.grid) elements.grid.innerHTML = message;
      if (elements.featured) elements.featured.hidden = true;
    }
  }

  setupFilters();
  loadPosts();
})();
