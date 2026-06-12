import { getSupabaseClient, getSupabaseDiagnostics } from '../services/supabase-client.js';
import {
  archiveArticle,
  createArticle,
  deleteArticle,
  generateSlug,
  getAllArticlesForAdmin,
  publishArticle,
  updateArticle,
  uploadArticleImage
} from '../services/articles-service.js';

const elements = {
  loginPanel: document.querySelector('#loginPanel'),
  dashboardPanel: document.querySelector('#dashboardPanel'),
  loginForm: document.querySelector('#loginForm'),
  loginButton: document.querySelector('#loginButton'),
  loginMessage: document.querySelector('#loginMessage'),
  logoutButton: document.querySelector('#logoutButton'),
  adminUserEmail: document.querySelector('#adminUserEmail'),
  dashboardMessage: document.querySelector('#dashboardMessage'),
  newArticleButton: document.querySelector('#newArticleButton'),
  adminTabs: document.querySelectorAll('[data-admin-tab]'),
  adminSections: document.querySelectorAll('[data-admin-section]'),
  openEditorButtons: document.querySelectorAll('[data-open-editor]'),
  articleFilterButtons: document.querySelectorAll('[data-article-filter]'),
  articleSearchInput: document.querySelector('#articleSearchInput'),
  articlesList: document.querySelector('#articlesList'),
  articleFormPanel: document.querySelector('#articleFormPanel'),
  articleForm: document.querySelector('#articleForm'),
  articleFormTitle: document.querySelector('#articleFormTitle'),
  articleId: document.querySelector('#articleId'),
  articleTitle: document.querySelector('#articleTitle'),
  articleSlug: document.querySelector('#articleSlug'),
  articleCategory: document.querySelector('#articleCategory'),
  articleAuthor: document.querySelector('#articleAuthor'),
  articleExcerpt: document.querySelector('#articleExcerpt'),
  articleCoverUrl: document.querySelector('#articleCoverUrl'),
  articleImage: document.querySelector('#articleImage'),
  articleContentField: document.querySelector('#articleContentField'),
  articleStatus: document.querySelector('#articleStatus'),
  articlePublishedAt: document.querySelector('#articlePublishedAt'),
  articleFeatured: document.querySelector('#articleFeatured'),
  coverPreviewBox: document.querySelector('#coverPreviewBox'),
  coverPreview: document.querySelector('#coverPreview'),
  saveDraftButton: document.querySelector('#saveDraftButton'),
  publishButton: document.querySelector('#publishButton'),
  updateButton: document.querySelector('#updateButton'),
  cancelEditButton: document.querySelector('#cancelEditButton'),
  statTotalArticles: document.querySelector('#statTotalArticles'),
  statPublishedArticles: document.querySelector('#statPublishedArticles'),
  statDraftArticles: document.querySelector('#statDraftArticles'),
  statArchivedArticles: document.querySelector('#statArchivedArticles'),
  summaryFeaturedArticle: document.querySelector('#summaryFeaturedArticle'),
  summaryLastPublished: document.querySelector('#summaryLastPublished'),
  summarySessionState: document.querySelector('#summarySessionState'),
  diagConfigured: document.querySelector('#diagConfigured'),
  diagProject: document.querySelector('#diagProject'),
  diagClient: document.querySelector('#diagClient'),
  diagSession: document.querySelector('#diagSession')
};

let supabase = null;
let currentSession = null;
let articles = [];
let slugTouched = false;
let activeArticleFilter = 'all';
let articleSearchTerm = '';
let previewObjectUrl = '';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setMessage(element, message = '', type = 'info') {
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
}

function setLoading(button, isLoading, label) {
  if (!button) return;
  button.disabled = isLoading;
  if (label) button.textContent = isLoading ? 'Chargement…' : label;
}

function setBadge(element, active) {
  if (!element) return;
  element.textContent = active ? 'Oui' : 'Non';
  element.classList.toggle('is-ok', Boolean(active));
  element.classList.toggle('is-ko', !active);
}

function formatDate(value) {
  if (!value) return 'Date non renseignée';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date non renseignée';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function updateDiagnostics() {
  const diagnostics = getSupabaseDiagnostics();
  setBadge(elements.diagConfigured, diagnostics.configured);
  setBadge(elements.diagClient, diagnostics.clientInitialized);
  setBadge(elements.diagSession, Boolean(currentSession));
  if (elements.diagProject) elements.diagProject.textContent = diagnostics.projectHost || 'Non configuré';
  if (elements.summarySessionState) {
    elements.summarySessionState.textContent = currentSession
      ? `Session active${currentSession.user?.email ? ` pour ${currentSession.user.email}` : ''}.`
      : 'Aucune session active.';
  }
  if (elements.adminUserEmail) {
    elements.adminUserEmail.textContent = currentSession?.user?.email || '';
    elements.adminUserEmail.hidden = !currentSession?.user?.email;
  }
}

function switchAdminSection(sectionName = 'overview') {
  elements.adminSections.forEach((section) => {
    const isTarget = section.dataset.adminSection === sectionName;
    section.hidden = !isTarget;
    section.classList.toggle('is-active', isTarget);
  });
  elements.adminTabs.forEach((tab) => {
    const isTarget = tab.dataset.adminTab === sectionName;
    tab.classList.toggle('is-active', isTarget);
    tab.setAttribute('aria-selected', String(isTarget));
  });
}

function showLogin(message = '') {
  elements.loginPanel.hidden = false;
  elements.dashboardPanel.hidden = true;
  elements.logoutButton.hidden = true;
  if (elements.adminUserEmail) elements.adminUserEmail.hidden = true;
  if (message) setMessage(elements.loginMessage, message, 'error');
  updateDiagnostics();
}

function showDashboard() {
  elements.loginPanel.hidden = true;
  elements.dashboardPanel.hidden = false;
  elements.logoutButton.hidden = false;
  switchAdminSection('overview');
  updateDiagnostics();
}

function getFriendlyError(error) {
  const message = String(error?.message || error || 'Erreur inconnue');
  if (/Invalid login credentials/i.test(message)) return 'Identifiants invalides. Vérifiez l’email, le mot de passe et le projet Supabase.';
  if (/Email not confirmed/i.test(message)) return 'Email non confirmé. Confirmez l’utilisateur dans Supabase Auth ou désactivez la confirmation si approprié.';
  if (/Failed to fetch|NetworkError/i.test(message)) return 'Erreur réseau. Vérifiez la connexion, l’URL Supabase et les domaines autorisés.';
  if (/not configured/i.test(message)) return 'Supabase client not configured : vérifiez js/config/supabase-config.js.';
  if (/row-level security|RLS|policy/i.test(message)) return 'Erreur RLS après connexion. Vérifiez les policies Supabase.';
  return message;
}

function statusLabel(status) {
  return { draft: 'brouillon', published: 'publié', archived: 'archivé' }[status] || status;
}

function getFilteredArticles() {
  return articles.filter((article) => {
    const matchesFilter = activeArticleFilter === 'all'
      || article.status === activeArticleFilter
      || (activeArticleFilter === 'featured' && article.featured);
    const matchesSearch = !articleSearchTerm
      || article.title.toLowerCase().includes(articleSearchTerm)
      || article.slug.toLowerCase().includes(articleSearchTerm);
    return matchesFilter && matchesSearch;
  });
}

function updateOverview() {
  const publishedArticles = articles.filter((article) => article.status === 'published');
  const draftArticles = articles.filter((article) => article.status === 'draft');
  const archivedArticles = articles.filter((article) => article.status === 'archived');
  const featuredArticle = articles.find((article) => article.featured);
  const lastPublished = [...publishedArticles].sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))[0];

  if (elements.statTotalArticles) elements.statTotalArticles.textContent = articles.length;
  if (elements.statPublishedArticles) elements.statPublishedArticles.textContent = publishedArticles.length;
  if (elements.statDraftArticles) elements.statDraftArticles.textContent = draftArticles.length;
  if (elements.statArchivedArticles) elements.statArchivedArticles.textContent = archivedArticles.length;
  if (elements.summaryFeaturedArticle) {
    elements.summaryFeaturedArticle.textContent = featuredArticle
      ? `${featuredArticle.title} — ${statusLabel(featuredArticle.status)}`
      : 'Aucun article à la une pour le moment.';
  }
  if (elements.summaryLastPublished) {
    elements.summaryLastPublished.textContent = lastPublished
      ? `${lastPublished.title} — publié le ${formatDate(lastPublished.publishedAt)}`
      : 'Aucun article publié pour le moment.';
  }
  updateDiagnostics();
}

function renderArticles() {
  if (!elements.articlesList) return;
  updateOverview();

  const filteredArticles = getFilteredArticles();
  if (!articles.length) {
    elements.articlesList.innerHTML = '<p class="empty-state">Aucun article pour le moment.</p>';
    return;
  }
  if (!filteredArticles.length) {
    elements.articlesList.innerHTML = '<p class="empty-state">Aucun article ne correspond à ce filtre.</p>';
    return;
  }

  elements.articlesList.innerHTML = filteredArticles.map((article) => `
    <article class="admin-article-item">
      <div>
        <div class="article-item-meta">
          <span class="status-badge status-${escapeHtml(article.status)}">${escapeHtml(statusLabel(article.status))}</span>
          ${article.featured ? '<span class="featured-badge">À la une</span>' : ''}
          ${article.category ? `<span class="category-badge">${escapeHtml(article.category)}</span>` : ''}
        </div>
        <h4>${escapeHtml(article.title)}</h4>
        <p>${escapeHtml(article.excerpt || 'Sans résumé')}</p>
        <small>Slug : ${escapeHtml(article.slug)} · ${escapeHtml(formatDate(article.publishedAt || article.createdAt))}</small>
      </div>
      <div class="article-item-actions">
        ${article.status === 'published' ? `<a class="btn mini" href="article.html?slug=${encodeURIComponent(article.slug)}" target="_blank" rel="noopener">Voir</a>` : ''}
        ${article.status !== 'published' ? `<button class="btn mini success" data-action="publish" data-id="${escapeHtml(article.id)}" type="button">Publier</button>` : ''}
        ${!article.featured ? `<button class="btn mini" data-action="feature" data-id="${escapeHtml(article.id)}" type="button">À la une</button>` : ''}
        <button class="btn mini" data-action="edit" data-id="${escapeHtml(article.id)}" type="button">Modifier</button>
        ${article.status !== 'archived' ? `<button class="btn mini warning" data-action="archive" data-id="${escapeHtml(article.id)}" type="button">Archiver</button>` : ''}
        <button class="btn mini danger" data-action="delete" data-id="${escapeHtml(article.id)}" type="button">Supprimer</button>
      </div>
    </article>
  `).join('');
}

async function loadArticles() {
  setMessage(elements.dashboardMessage, 'Chargement des articles…', 'info');
  try {
    articles = await getAllArticlesForAdmin();
    renderArticles();
    setMessage(elements.dashboardMessage, 'Articles chargés.', 'success');
  } catch (error) {
    setMessage(elements.dashboardMessage, getFriendlyError(error), 'error');
  }
}

function updateCoverPreview(source = elements.articleCoverUrl?.value || '') {
  if (!elements.coverPreviewBox || !elements.coverPreview) return;
  if (!source) {
    elements.coverPreviewBox.hidden = true;
    elements.coverPreview.removeAttribute('src');
    return;
  }
  elements.coverPreview.src = source;
  elements.coverPreviewBox.hidden = false;
}

function resetForm() {
  elements.articleForm.reset();
  elements.articleId.value = '';
  elements.articleAuthor.value = 'Agri-tech';
  elements.articleStatus.value = 'draft';
  elements.articleFormTitle.textContent = 'Nouvel article';
  slugTouched = false;
  updateCoverPreview('');
}

function openForm(article = null) {
  elements.articleFormPanel.hidden = false;
  switchAdminSection('editor');
  if (!article) {
    resetForm();
    elements.articleTitle?.focus();
    return;
  }

  elements.articleFormTitle.textContent = 'Modifier l’article';
  elements.articleId.value = article.id || '';
  elements.articleTitle.value = article.title || '';
  elements.articleSlug.value = article.slug || '';
  elements.articleCategory.value = article.category || '';
  elements.articleAuthor.value = article.author || 'Agri-tech';
  elements.articleExcerpt.value = article.excerpt || '';
  elements.articleCoverUrl.value = article.coverImage || '';
  elements.articleContentField.value = article.content || '';
  elements.articleStatus.value = article.status || 'draft';
  elements.articlePublishedAt.value = article.publishedAt ? article.publishedAt.slice(0, 16) : '';
  elements.articleFeatured.checked = Boolean(article.featured);
  updateCoverPreview(article.coverImage || '');
  slugTouched = true;
  elements.articleTitle?.focus();
}

function collectFormPayload(forcedStatus = null) {
  const status = forcedStatus || elements.articleStatus.value || 'draft';
  const publishedAt = elements.articlePublishedAt.value ? new Date(elements.articlePublishedAt.value).toISOString() : null;
  return {
    title: elements.articleTitle.value,
    slug: elements.articleSlug.value,
    category: elements.articleCategory.value,
    excerpt: elements.articleExcerpt.value,
    cover_image_url: elements.articleCoverUrl.value,
    author: elements.articleAuthor.value,
    content: elements.articleContentField.value,
    status,
    featured: elements.articleFeatured.checked,
    published_at: status === 'published' ? (publishedAt || new Date().toISOString()) : publishedAt
  };
}

async function saveArticle(forcedStatus = null) {
  if (!elements.articleTitle.value.trim() || !elements.articleSlug.value.trim() || !elements.articleCategory.value.trim() || !elements.articleContentField.value.trim()) {
    setMessage(elements.dashboardMessage, 'Titre, slug, catégorie et contenu sont obligatoires.', 'error');
    return;
  }

  setMessage(elements.dashboardMessage, 'Enregistrement en cours…', 'info');
  try {
    let payload = collectFormPayload(forcedStatus);
    const file = elements.articleImage.files?.[0];
    if (file) {
      payload.cover_image_url = await uploadArticleImage(file, payload.slug);
      elements.articleCoverUrl.value = payload.cover_image_url;
      updateCoverPreview(payload.cover_image_url);
    }

    const savedArticle = elements.articleId.value
      ? await updateArticle(elements.articleId.value, payload)
      : await createArticle(payload);

    setMessage(elements.dashboardMessage, `Article ${statusLabel(savedArticle.status)} enregistré avec succès.`, 'success');
    elements.articleId.value = savedArticle.id;
    await loadArticles();
  } catch (error) {
    setMessage(elements.dashboardMessage, getFriendlyError(error), 'error');
  }
}

async function initSession() {
  supabase = await getSupabaseClient();
  if (!supabase) {
    showLogin('Supabase non configuré. Renseignez uniquement l’URL publique et la clé anon/publishable.');
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showLogin(getFriendlyError(error));
    return;
  }

  currentSession = data?.session || null;
  if (!currentSession) {
    showLogin();
    return;
  }

  showDashboard();
  await loadArticles();

  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    updateDiagnostics();
    if (!session) showLogin();
  });
}

function bindEvents() {
  elements.loginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(elements.loginMessage, '', 'info');
    supabase = supabase || await getSupabaseClient();
    if (!supabase) {
      setMessage(elements.loginMessage, 'Supabase client not configured.', 'error');
      updateDiagnostics();
      return;
    }

    setLoading(elements.loginButton, true, 'Se connecter');
    const formData = new FormData(elements.loginForm);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(formData.get('email') || '').trim(),
        password: String(formData.get('password') || '')
      });
      if (error) throw error;
      currentSession = data?.session || null;
      showDashboard();
      await loadArticles();
    } catch (error) {
      setMessage(elements.loginMessage, getFriendlyError(error), 'error');
    } finally {
      setLoading(elements.loginButton, false, 'Se connecter');
      updateDiagnostics();
    }
  });

  elements.logoutButton?.addEventListener('click', async () => {
    if (supabase) await supabase.auth.signOut();
    currentSession = null;
    articles = [];
    updateOverview();
    showLogin('Vous êtes déconnecté.');
  });

  elements.adminTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchAdminSection(tab.dataset.adminTab));
  });

  elements.openEditorButtons.forEach((button) => {
    button.addEventListener('click', () => openForm());
  });

  elements.articleFilterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeArticleFilter = button.dataset.articleFilter || 'all';
      elements.articleFilterButtons.forEach((item) => item.classList.toggle('is-active', item === button));
      renderArticles();
    });
  });

  elements.articleSearchInput?.addEventListener('input', () => {
    articleSearchTerm = elements.articleSearchInput.value.trim().toLowerCase();
    renderArticles();
  });

  elements.newArticleButton?.addEventListener('click', () => openForm());
  elements.cancelEditButton?.addEventListener('click', () => {
    resetForm();
    switchAdminSection('articles');
  });
  elements.articleTitle?.addEventListener('input', () => {
    if (!slugTouched) elements.articleSlug.value = generateSlug(elements.articleTitle.value);
  });
  elements.articleSlug?.addEventListener('input', () => { slugTouched = true; });
  elements.articleSlug?.addEventListener('blur', () => { elements.articleSlug.value = generateSlug(elements.articleSlug.value); });
  elements.articleCoverUrl?.addEventListener('input', () => updateCoverPreview(elements.articleCoverUrl.value));
  elements.articleImage?.addEventListener('change', () => {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    const file = elements.articleImage.files?.[0];
    previewObjectUrl = file ? URL.createObjectURL(file) : '';
    updateCoverPreview(previewObjectUrl || elements.articleCoverUrl.value);
  });

  elements.articleForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveArticle();
  });
  elements.saveDraftButton?.addEventListener('click', async () => { await saveArticle('draft'); });
  elements.publishButton?.addEventListener('click', async () => { await saveArticle('published'); });

  elements.articlesList?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const article = articles.find((item) => item.id === button.dataset.id);
    if (!article) return;

    if (button.dataset.action === 'edit') {
      openForm(article);
      return;
    }

    try {
      if (button.dataset.action === 'publish') {
        if (!window.confirm('Publier cet article ?')) return;
        await publishArticle(article.id);
        setMessage(elements.dashboardMessage, 'Article publié.', 'success');
      }
      if (button.dataset.action === 'feature') {
        const payload = {
          title: article.title,
          slug: article.slug,
          category: article.category,
          excerpt: article.excerpt,
          cover_image_url: article.coverImage,
          author: article.author,
          content: article.content,
          status: article.status,
          featured: true,
          published_at: article.publishedAt || null
        };
        await updateArticle(article.id, payload);
        setMessage(elements.dashboardMessage, 'Article mis à la une.', 'success');
      }
      if (button.dataset.action === 'archive') {
        if (!window.confirm('Archiver cet article ?')) return;
        await archiveArticle(article.id);
        setMessage(elements.dashboardMessage, 'Article archivé.', 'success');
      }
      if (button.dataset.action === 'delete') {
        if (!window.confirm('Supprimer définitivement cet article ?')) return;
        await deleteArticle(article.id);
        setMessage(elements.dashboardMessage, 'Article supprimé.', 'success');
      }
      await loadArticles();
    } catch (error) {
      setMessage(elements.dashboardMessage, getFriendlyError(error), 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  updateDiagnostics();
  await initSession();
});
