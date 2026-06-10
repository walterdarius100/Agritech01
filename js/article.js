(() => {
  const postsUrl = 'data/blog-posts.json';
  const articleRoot = document.querySelector('#articleRoot');
  const relatedRoot = document.querySelector('#relatedPosts');

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

  function getSlug() {
    return new URLSearchParams(window.location.search).get('slug') || '';
  }

  function isPublished(post) {
    return post && post.published !== false;
  }

  function sortPosts(posts) {
    return [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function coverMarkup(post) {
    if (post.cover) {
      return `<figure class="article-cover"><img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}" loading="eager" decoding="async" /></figure>`;
    }

    return '<figure class="article-cover"><div class="news-placeholder" aria-hidden="true"><span>🌿</span></div></figure>';
  }

  function cardMarkup(post) {
    return `
      <article class="news-card">
        <div class="news-card-image"><img src="${escapeHtml(post.cover || 'assets/images/pepiniere.jpg')}" alt="${escapeHtml(post.title)}" loading="lazy" decoding="async" /></div>
        <div class="news-card-body">
          <div class="news-meta">
            <span class="news-category">${escapeHtml(post.category)}</span>
            <span class="news-type">${escapeHtml(post.type)}</span>
          </div>
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.excerpt)}</p>
          <a class="news-card-link" href="article.html?slug=${encodeURIComponent(post.slug)}">Lire l’article →</a>
        </div>
      </article>`;
  }

  function renderNotFound() {
    if (!articleRoot) return;
    document.title = 'Actualité introuvable | Agri-tech';
    articleRoot.innerHTML = `
      <div class="article-not-found">
        <span class="eyebrow">Actualité introuvable</span>
        <h1>Cette publication n’existe pas ou n’est plus disponible.</h1>
        <p class="article-excerpt">Retournez à la page des actualités agricoles pour consulter les dernières informations, alertes et analyses publiées par Agri-tech.</p>
        <div class="blog-cta-actions"><a class="btn primary" href="blog.html">Voir toutes les actualités</a></div>
      </div>`;
    if (relatedRoot) relatedRoot.innerHTML = '';
  }

  function renderArticle(post) {
    if (!articleRoot) return;
    document.title = `${post.title} | Actualités agricoles Agri-tech`;
    articleRoot.innerHTML = `
      <article class="article-shell">
        <header class="article-header">
          <div class="news-meta">
            <span class="news-category">${escapeHtml(post.category)}</span>
            <span class="news-type">${escapeHtml(post.type)}</span>
            <time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>
            <span>Par ${escapeHtml(post.author)}</span>
          </div>
          <h1>${escapeHtml(post.title)}</h1>
          <p class="article-excerpt">${escapeHtml(post.excerpt)}</p>
        </header>
        ${coverMarkup(post)}
        <div class="article-content">
          ${(post.content || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
        </div>
      </article>`;
  }

  function renderRelated(posts, currentPost) {
    if (!relatedRoot) return;
    const related = sortPosts(posts)
      .filter((post) => post.slug !== currentPost.slug && post.category === currentPost.category)
      .slice(0, 3);
    const fallback = sortPosts(posts)
      .filter((post) => post.slug !== currentPost.slug)
      .slice(0, 3);
    const items = related.length ? related : fallback;

    relatedRoot.innerHTML = items.length
      ? `<div class="related-section"><h2>Articles similaires</h2><div class="news-grid">${items.map(cardMarkup).join('')}</div></div>`
      : '';
  }

  async function loadArticle() {
    if (!articleRoot) return;

    try {
      const response = await fetch(postsUrl);
      if (!response.ok) throw new Error(`Chargement impossible (${response.status})`);
      const postsData = await response.json();
      const posts = Array.isArray(postsData) ? postsData.filter(isPublished) : [];
      const post = posts.find((item) => item.slug === getSlug()) || null;

      if (!post) {
        renderNotFound();
        return;
      }

      renderArticle(post);
      renderRelated(posts, post);
    } catch (error) {
      console.error('Erreur de chargement de l’article:', error);
      renderNotFound();
    }
  }

  loadArticle();
})();
