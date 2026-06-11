import { escapeHtml } from '../utils/sanitize.js';
import {
  archiveArticle,
  deleteArticle,
  generateSlug,
  getAllArticlesForAdmin,
  getCurrentSession,
  isSupabaseConfigured,
  onAuthStateChange,
  saveArticle,
  signInAdmin,
  signOutAdmin,
  uploadArticleImage,
} from '../services/articles-service.js';

const loginSection = document.querySelector('#loginSection');
const dashboardSection = document.querySelector('#dashboardSection');
const logoutBtn = document.querySelector('#logoutBtn');
const loginForm = document.querySelector('#loginForm');
const loginMessage = document.querySelector('#loginMessage');
const dashboardMessage = document.querySelector('#dashboardMessage');
const articlesList = document.querySelector('#articlesList');
const loadingIndicator = document.querySelector('#loadingIndicator');
const editorSection = document.querySelector('#editorSection');
const editorTitle = document.querySelector('#editorTitle');
const articleForm = document.querySelector('#articleForm');
const newArticleBtn = document.querySelector('#newArticleBtn');
const saveDraftBtn = document.querySelector('#saveDraftBtn');
const publishBtn = document.querySelector('#publishBtn');
const cancelEditBtn = document.querySelector('#cancelEditBtn');
const cancelEditTopBtn = document.querySelector('#cancelEditTopBtn');
const titleInput = document.querySelector('#articleTitle');
const slugInput = document.querySelector('#articleSlug');
const statusInput = document.querySelector('#articleStatus');
const publishedAtInput = document.querySelector('#publishedAt');
const imageInput = document.querySelector('#articleImage');
const coverImageUrlInput = document.querySelector('#coverImageUrl');

let articles = [];
let slugTouched = false;

function setMessage(element, message = '', type = '') {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle('is-success', type === 'success');
  element.classList.toggle('is-error', type === 'error');
}

function setLoading(isLoading) {
  loadingIndicator?.classList.toggle('is-hidden', !isLoading);
}

function showAuthenticatedState(isAuthenticated) {
  loginSection?.classList.toggle('is-hidden', isAuthenticated);
  dashboardSection?.classList.toggle('is-hidden', !isAuthenticated);
  logoutBtn?.classList.toggle('is-hidden', !isAuthenticated);
}

function statusLabel(status) {
  return {
    draft: 'Brouillon',
    published: 'Publié',
    archived: 'Archivé',
  }[status] || status;
}

function formatDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function toIsoDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function renderArticles() {
  if (!articlesList) return;
  if (!articles.length) {
    articlesList.innerHTML = '<p class="empty-state">Aucun article pour le moment. Créez votre première actualité.</p>';
    return;
  }

  articlesList.innerHTML = articles.map((article) => `
    <article class="admin-article-item" data-id="${escapeHtml(article.id)}">
      <div class="admin-article-top">
        <div class="admin-article-title">
          <h3>${escapeHtml(article.title)}</h3>
          <p>${escapeHtml(article.slug)}</p>
        </div>
        <span class="status-badge status-${escapeHtml(article.status)}">${escapeHtml(statusLabel(article.status))}</span>
      </div>
      <div class="admin-article-actions" aria-label="Actions pour ${escapeHtml(article.title)}">
        ${article.featured ? '<span class="status-badge status-featured">À la une</span>' : ''}
        <button class="btn secondary" type="button" data-action="edit">Modifier</button>
        <button class="btn secondary" type="button" data-action="archive">Archiver</button>
        <button class="admin-link-btn" type="button" data-action="delete">Supprimer</button>
        ${article.status === 'published' ? `<a class="admin-link-btn" href="article.html?slug=${encodeURIComponent(article.slug)}" target="_blank" rel="noopener noreferrer">Voir l’article</a>` : ''}
      </div>
    </article>
  `).join('');
}

async function loadArticles() {
  setLoading(true);
  try {
    articles = await getAllArticlesForAdmin();
    renderArticles();
  } catch (error) {
    setMessage(dashboardMessage, error.message || 'Impossible de charger les articles.', 'error');
  } finally {
    setLoading(false);
  }
}

function resetForm() {
  articleForm?.reset();
  document.querySelector('#articleId').value = '';
  document.querySelector('#articleCategory').value = 'Conseils';
  document.querySelector('#articleAuthor').value = 'Agri-tech';
  coverImageUrlInput.value = '';
  publishedAtInput.value = '';
  slugTouched = false;
  editorTitle.textContent = 'Nouvel article';
}

function openEditor(article = null) {
  resetForm();
  editorSection?.classList.remove('is-hidden');
  if (!article) {
    editorSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  editorTitle.textContent = 'Modifier l’article';
  document.querySelector('#articleId').value = article.id || '';
  titleInput.value = article.title || '';
  slugInput.value = article.slug || '';
  document.querySelector('#articleCategory').value = article.category || '';
  document.querySelector('#articleAuthor').value = article.author || 'Agri-tech';
  document.querySelector('#articleExcerpt').value = article.excerpt || '';
  coverImageUrlInput.value = article.cover_image_url || article.coverImage || '';
  document.querySelector('#articleContentInput').value = article.content || '';
  statusInput.value = article.status || 'draft';
  document.querySelector('#articleFeatured').checked = article.featured === true;
  publishedAtInput.value = formatDateTimeLocal(article.publishedAt);
  slugTouched = true;
  editorSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeEditor() {
  resetForm();
  editorSection?.classList.add('is-hidden');
}

async function collectFormData(statusOverride = null) {
  const title = titleInput.value.trim();
  const slug = generateSlug(slugInput.value || title);
  const status = statusOverride || statusInput.value;
  let coverImageUrl = coverImageUrlInput.value.trim();

  if (!title || !slug || !document.querySelector('#articleCategory').value.trim() || !document.querySelector('#articleContentInput').value.trim()) {
    throw new Error('Titre, slug, catégorie et contenu sont obligatoires.');
  }

  if (imageInput.files[0]) {
    setMessage(dashboardMessage, 'Upload de l’image en cours…');
    coverImageUrl = await uploadArticleImage(imageInput.files[0], slug);
    coverImageUrlInput.value = coverImageUrl;
  }

  return {
    id: document.querySelector('#articleId').value || null,
    title,
    slug,
    category: document.querySelector('#articleCategory').value.trim(),
    excerpt: document.querySelector('#articleExcerpt').value.trim(),
    cover_image_url: coverImageUrl,
    author: document.querySelector('#articleAuthor').value.trim() || 'Agri-tech',
    content: document.querySelector('#articleContentInput').value.trim(),
    status,
    featured: document.querySelector('#articleFeatured').checked,
    published_at: status === 'published' ? toIsoDate(publishedAtInput.value) : null,
  };
}

async function submitArticle(statusOverride = null) {
  setLoading(true);
  try {
    const payload = await collectFormData(statusOverride);
    const article = await saveArticle(payload);
    setMessage(dashboardMessage, `Article « ${article.title} » enregistré.`, 'success');
    closeEditor();
    await loadArticles();
  } catch (error) {
    setMessage(dashboardMessage, error.message || 'Impossible d’enregistrer l’article.', 'error');
  } finally {
    setLoading(false);
  }
}

async function initAdmin() {
  if (!isSupabaseConfigured()) {
    showAuthenticatedState(false);
    setMessage(loginMessage, 'Supabase n’est pas configuré. Ajoutez SUPABASE_URL et SUPABASE_ANON_KEY dans js/config/supabase-config.js.', 'error');
    return;
  }

  try {
    const session = await getCurrentSession();
    showAuthenticatedState(Boolean(session));
    if (session) await loadArticles();
    await onAuthStateChange(async (nextSession) => {
      showAuthenticatedState(Boolean(nextSession));
      if (nextSession) await loadArticles();
    });
  } catch (error) {
    showAuthenticatedState(false);
    setMessage(loginMessage, error.message || 'Impossible d’initialiser Supabase.', 'error');
  }
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(loginMessage, 'Connexion en cours…');
  try {
    await signInAdmin(new FormData(loginForm).get('email'), new FormData(loginForm).get('password'));
    setMessage(loginMessage, '', 'success');
    showAuthenticatedState(true);
    await loadArticles();
  } catch (error) {
    setMessage(loginMessage, 'Connexion impossible. Vérifiez l’email et le mot de passe.', 'error');
  }
});

logoutBtn?.addEventListener('click', async () => {
  await signOutAdmin();
  articles = [];
  renderArticles();
  closeEditor();
  showAuthenticatedState(false);
});

newArticleBtn?.addEventListener('click', () => openEditor());
cancelEditBtn?.addEventListener('click', closeEditor);
cancelEditTopBtn?.addEventListener('click', closeEditor);

articlesList?.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  const item = actionButton.closest('[data-id]');
  const article = articles.find((entry) => entry.id === item?.dataset.id);
  if (!article) return;

  const action = actionButton.dataset.action;
  if (action === 'edit') openEditor(article);
  if (action === 'archive') {
    if (!confirm(`Archiver l’article « ${article.title} » ?`)) return;
    await archiveArticle(article.id);
    setMessage(dashboardMessage, 'Article archivé.', 'success');
    await loadArticles();
  }
  if (action === 'delete') {
    if (!confirm(`Supprimer définitivement l’article « ${article.title} » ?`)) return;
    await deleteArticle(article.id);
    setMessage(dashboardMessage, 'Article supprimé.', 'success');
    await loadArticles();
  }
});

titleInput?.addEventListener('input', () => {
  if (!slugTouched) slugInput.value = generateSlug(titleInput.value);
});
slugInput?.addEventListener('input', () => {
  slugTouched = true;
  slugInput.value = generateSlug(slugInput.value);
});
statusInput?.addEventListener('change', () => {
  if (statusInput.value === 'published' && !publishedAtInput.value) {
    publishedAtInput.value = formatDateTimeLocal(new Date().toISOString());
  }
});
saveDraftBtn?.addEventListener('click', () => submitArticle('draft'));
publishBtn?.addEventListener('click', () => {
  if (!publishedAtInput.value) publishedAtInput.value = formatDateTimeLocal(new Date().toISOString());
  submitArticle('published');
});
articleForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  submitArticle();
});

initAdmin();
