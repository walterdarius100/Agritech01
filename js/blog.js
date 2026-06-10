(() => {
  const postsUrl = 'data/blog-posts.json';
  const allCategory = 'Tous';
  const preferredCategoryOrder = [allCategory, 'Actualités', 'Alertes', 'Événements', 'Marché agricole', 'Analyse Agri-tech'];
  const state = { posts: [], activeCategory: allCategory };

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

  function normalizePosts(posts) {
    if (!Array.isArray(posts)) return [];

    return posts.filter((post) => (
      post &&
      post.slug &&
      post.title &&
      post.excerpt &&
      post.category &&
      post.date
    ));
  }

  function getCategories(posts) {
    const postCategories = [...new Set(posts.map((post) => post.category).filter(Boolean))];
    const ordered = preferredCategoryOrder.filter((category) => category === allCategory || postCategories.includes(category));
    const extra = postCategories.filter((category) => !ordered.includes(category)).sort((a, b) => a.localeCompare(b, 'fr'));

    return [...ordered, ...extra];
  }

  function coverMarkup(post, className = 'news-card-image', loading = 'lazy') {
    if (post.cover) {
      return `<div class="${className}"><img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}" loading="${loading}" decoding="async" /></div>`;
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
            <span class="news-type">${escapeHtml(post.type || 'Publication')}</span>
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
    const categories = getCategories(posts);

    if (!categories.includes(state.activeCategory)) {
      state.activeCategory = allCategory;
    }

    elements.filters.innerHTML = categories
      .map((category) => {
        const isActive = category === state.activeCategory;
        return `<button class="blog-filter-btn ${isActive ? 'active' : ''}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${isActive}">${escapeHtml(category)}</button>`;
      })
      .join('');
  }

  function renderFeatured(posts) {
    if (!elements.featured) return;
    const featuredPost = sortPosts(posts).find((post) => post.featured) || sortPosts(posts)[0];

    if (!featuredPost) {
      elements.featured.innerHTML = '';
      elements.featured.hidden = true;
      return;
    }

    elements.featured.hidden = false;
    elements.featured.innerHTML = `
      ${coverMarkup(featuredPost, 'featured-news-image', 'eager')}
      <div class="featured-news-content">
        <div class="news-meta">
          <span class="news-category">À la une</span>
          <span class="news-type">${escapeHtml(featuredPost.category)}</span>
          <time datetime="${escapeHtml(featuredPost.date)}">${escapeHtml(formatDate(featuredPost.date))}</time>
        </div>
        <h2>${escapeHtml(featuredPost.title)}</h2>
        <p>${escapeHtml(featuredPost.excerpt)}</p>
        <a href="article.html?slug=${encodeURIComponent(featuredPost.slug)}" class="btn primary">Lire l’article</a>
      </div>`;
  }

  function getVisiblePosts(posts) {
    const sorted = sortPosts(posts);
    if (state.activeCategory === allCategory) return sorted;
    return sorted.filter((post) => post.category === state.activeCategory);
  }

  function renderGrid(posts) {
    if (!elements.grid) return;
    const visiblePosts = getVisiblePosts(posts);

    elements.grid.innerHTML = visiblePosts.length
      ? visiblePosts.map(cardMarkup).join('')
      : '<div class="empty-state">Aucune publication n’est disponible dans cette catégorie pour le moment.</div>';
  }

  function setupFilters() {
    if (!elements.filters) return;
    elements.filters.addEventListener('click', (event) => {
      const button = event.target.closest('[data-category]');
      if (!button) return;
      state.activeCategory = button.dataset.category || allCategory;
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
      state.posts = normalizePosts(await response.json());
      renderHome(state.posts);
      renderFilters(state.posts);
      renderFeatured(state.posts);
      renderGrid(state.posts);
    } catch (error) {
      console.error('Erreur de chargement des actualités:', error);
      const message = '<div class="empty-state">Les actualités agricoles ne peuvent pas être chargées pour le moment.</div>';
      if (elements.homeGrid) elements.homeGrid.innerHTML = message;
      if (elements.grid) elements.grid.innerHTML = message;
      if (elements.filters) elements.filters.innerHTML = '';
      if (elements.featured) elements.featured.hidden = true;
    }
  }

  setupFilters();
  loadPosts();
})();
