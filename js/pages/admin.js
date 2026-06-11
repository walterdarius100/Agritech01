import { getSupabaseClient, getSupabaseDiagnostics, getSupabaseSession } from '../services/supabase-client.js';
import { archiveArticle, createArticle, deleteArticle, generateSlug, getAllArticlesForAdmin, updateArticle, uploadArticleImage } from '../services/articles-service.js';
import { escapeHtml } from '../utils/sanitize.js';

const statusLabels = { draft: 'brouillon', published: 'publié', archived: 'archivé' };
const statusClasses = { draft: 'draft', published: 'published', archived: 'archived' };

const elements = {
  loginPanel: document.querySelector('#loginPanel'),
  dashboardPanel: document.querySelector('#dashboardPanel'),
  loginForm: document.querySelector('#loginForm'),
  loginBtn: document.querySelector('#loginBtn'),
  logoutBtn: document.querySelector('#logoutBtn'),
  loginMessage: document.querySelector('#loginMessage'),
  dashboardMessage: document.querySelector('#dashboardMessage'),
  articlesList: document.querySelector('#articlesList'),
  newArticleBtn: document.querySelector('#newArticleBtn'),
  articleFormCard: document.querySelector('#articleFormCard'),
  articleForm: document.querySelector('#articleForm'),
  formTitle: document.querySelector('#formTitle'),
  articleId: document.querySelector('#articleId'),
  title: document.querySelector('#articleTitle'),
  slug: document.querySelector('#articleSlug'),
  category: document.querySelector('#articleCategory'),
  excerpt: document.querySelector('#articleExcerpt'),
  image: document.querySelector('#articleImage'),
  coverUrl: document.querySelector('#articleCoverUrl'),
  author: document.querySelector('#articleAuthor'),
  content: document.querySelector('#articleContent'),
  status: document.querySelector('#articleStatus'),
  featured: document.querySelector('#articleFeatured'),
  publishedAt: document.querySelector('#articlePublishedAt'),
  saveDraftBtn: document.querySelector('#saveDraftBtn'),
  publishBtn: document.querySelector('#publishBtn'),
  saveArticleBtn: document.querySelector('#saveArticleBtn'),
  cancelButtons: document.querySelectorAll('#cancelFormBtn, #cancelFormBtnBottom'),
  diagConfigured: document.querySelector('#diagConfigured'),
  diagProject: document.querySelector('#diagProject'),
  diagInitialized: document.querySelector('#diagInitialized'),
  diagSession: document.querySelector('#diagSession')
};

let currentSession = null;
let articles = [];
let slugTouched = false;

function setMessage(target, message = '', type = '') {
  if (!target) return;
  target.textContent = message;
  target.className = `admin-message ${type}`.trim();
}

function setLoading(button, loading, label) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? 'Chargement…' : label;
}

function formatDate(value) {
  if (!value) return 'Non publié';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date invalide';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function updateDiagnostics() {
  const diagnostics = getSupabaseDiagnostics();
  elements.diagConfigured.textContent = diagnostics.configured ? 'Oui' : 'Non';
  elements.diagProject.textContent = diagnostics.projectHost || 'Non configuré';
  elements.diagInitialized.textContent = diagnostics.initialized ? 'Oui' : 'Non';
  elements.diagSession.textContent = currentSession ? 'Oui' : 'Non';
}

function showLogin() {
  elements.loginPanel.hidden = false;
  elements.dashboardPanel.hidden = true;
  elements.logoutBtn.hidden = true;
  updateDiagnostics();
}

function showDashboard() {
  elements.loginPanel.hidden = true;
  elements.dashboardPanel.hidden = false;
  elements.logoutBtn.hidden = false;
  updateDiagnostics();
}

function getFriendlyError(error) {
  const message = error?.message || String(error || 'Erreur inconnue');
  if (/Invalid login credentials/i.test(message)) return 'Identifiants invalides. Vérifiez l’email, le mot de passe et le projet Supabase.';
  if (/Email not confirmed/i.test(message)) return 'Email non confirmé. Confirmez l’utilisateur dans Supabase Auth.';
  if (/Supabase client not configured/i.test(message)) return 'Supabase non configuré. Vérifiez js/config/supabase-config.js.';
  if (/Failed to fetch|NetworkError|fetch/i.test(message)) return 'Erreur réseau. Vérifiez la connexion, l’URL Supabase et Vercel Preview.';
  if (/JWT|policy|row-level|permission|RLS/i.test(message)) return 'Erreur RLS ou permission Supabase après connexion. Vérifiez les policies.';
  return message;
}

function renderArticles() {
  if (!elements.articlesList) return;
  if (!articles.length) {
    elements.articlesList.innerHTML = '<p class="empty-state">Aucun article pour le moment. Cliquez sur “Nouvel article”.</p>';
    return;
  }

  elements.articlesList.innerHTML = articles.map((article) => `
    <article class="admin-article-item">
      <div>
        <div class="article-row-title">
          <h3>${escapeHtml(article.title)}</h3>
          ${article.featured ? '<span class="featured-pill">À la une</span>' : ''}
        </div>
        <p>${escapeHtml(article.excerpt || 'Aucun résumé renseigné.')}</p>
        <div class="article-admin-meta">
          <span class="status-badge ${statusClasses[article.status] || 'draft'}">${statusLabels[article.status] || article.status}</span>
          <span>${escapeHtml(article.category)}</span>
          <span>${escapeHtml(formatDate(article.publishedAt))}</span>
        </div>
      </div>
      <div class="article-actions">
        <button type="button" data-action="edit" data-id="${escapeHtml(article.id)}">Modifier</button>
        <button type="button" data-action="archive" data-id="${escapeHtml(article.id)}" ${article.status === 'archived' ? 'disabled' : ''}>Archiver</button>
        <button type="button" data-action="delete" data-id="${escapeHtml(article.id)}" class="danger">Supprimer</button>
        ${article.status === 'published' ? `<a href="article.html?slug=${encodeURIComponent(article.slug)}" target="_blank" rel="noopener noreferrer">Voir l’article</a>` : ''}
      </div>
    </article>
  `).join('');
}

async function loadArticles() {
  setMessage(elements.dashboardMessage, 'Chargement des articles…', 'info');
  articles = await getAllArticlesForAdmin();
  renderArticles();
  setMessage(elements.dashboardMessage, `${articles.length} article(s) chargé(s).`, 'success');
}

function openForm(article = null) {
  slugTouched = Boolean(article);
  elements.articleFormCard.hidden = false;
  elements.formTitle.textContent = article ? 'Modifier l’article' : 'Nouvel article';
  elements.articleId.value = article?.id || '';
  elements.title.value = article?.title || '';
  elements.slug.value = article?.slug || '';
  elements.category.value = article?.category || '';
  elements.excerpt.value = article?.excerpt || '';
  elements.coverUrl.value = article?.cover_image_url || article?.coverImage || '';
  elements.author.value = article?.author || 'Agri-tech';
  elements.content.value = Array.isArray(article?.content) ? article.content.join('\n\n') : (article?.content || '');
  elements.status.value = article?.status || 'draft';
  elements.featured.checked = Boolean(article?.featured);
  elements.publishedAt.value = toDatetimeLocal(article?.publishedAt);
  elements.image.value = '';
  elements.saveArticleBtn.textContent = article ? 'Mettre à jour' : 'Créer l’article';
  elements.articleFormCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeForm() {
  elements.articleForm.reset();
  elements.articleId.value = '';
  elements.articleFormCard.hidden = true;
  slugTouched = false;
}

function collectForm(statusOverride = null) {
  const status = statusOverride || elements.status.value;
  return {
    title: elements.title.value.trim(),
    slug: generateSlug(elements.slug.value || elements.title.value),
    category: elements.category.value.trim(),
    excerpt: elements.excerpt.value.trim(),
    cover_image_url: elements.coverUrl.value.trim(),
    author: elements.author.value.trim() || 'Agri-tech',
    content: elements.content.value.trim(),
    status,
    featured: elements.featured.checked,
    published_at: elements.publishedAt.value ? new Date(elements.publishedAt.value).toISOString() : null
  };
}

async function saveArticle(statusOverride = null) {
  const payload = collectForm(statusOverride);
  if (!payload.title || !payload.slug || !payload.category || !payload.content) {
    setMessage(elements.dashboardMessage, 'Titre, slug, catégorie et contenu sont obligatoires.', 'error');
    return;
  }

  setLoading(elements.saveArticleBtn, true, elements.articleId.value ? 'Mettre à jour' : 'Créer l’article');
  setMessage(elements.dashboardMessage, 'Enregistrement en cours…', 'info');
  try {
    const selectedFile = elements.image.files?.[0];
    if (selectedFile) payload.cover_image_url = await uploadArticleImage(selectedFile, payload.slug);

    if (elements.articleId.value) {
      await updateArticle(elements.articleId.value, payload);
    } else {
      await createArticle(payload);
    }
    await loadArticles();
    closeForm();
    setMessage(elements.dashboardMessage, statusOverride === 'published' ? 'Article publié avec succès.' : 'Article enregistré avec succès.', 'success');
  } catch (error) {
    setMessage(elements.dashboardMessage, getFriendlyError(error), 'error');
  } finally {
    setLoading(elements.saveArticleBtn, false, elements.articleId.value ? 'Mettre à jour' : 'Créer l’article');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  setLoading(elements.loginBtn, true, 'Se connecter');
  setMessage(elements.loginMessage, 'Connexion en cours…', 'info');
  try {
    const client = await getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');
    const email = elements.loginForm.email.value.trim();
    const password = elements.loginForm.password.value;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentSession = data?.session || await getSupabaseSession();
    if (!currentSession) throw new Error('Session Supabase introuvable après connexion.');
    showDashboard();
    await loadArticles();
    setMessage(elements.loginMessage, '', '');
  } catch (error) {
    currentSession = null;
    showLogin();
    setMessage(elements.loginMessage, getFriendlyError(error), 'error');
  } finally {
    setLoading(elements.loginBtn, false, 'Se connecter');
    updateDiagnostics();
  }
}

async function handleLogout() {
  const client = await getSupabaseClient();
  if (client) await client.auth.signOut();
  currentSession = null;
  closeForm();
  showLogin();
}

async function handleArticleAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const article = articles.find((item) => item.id === target.dataset.id);
  if (!article) return;

  if (target.dataset.action === 'edit') openForm(article);
  if (target.dataset.action === 'archive' && window.confirm('Archiver cet article ? Il ne sera plus visible publiquement.')) {
    try {
      await archiveArticle(article.id);
      await loadArticles();
      setMessage(elements.dashboardMessage, 'Article archivé.', 'success');
    } catch (error) {
      setMessage(elements.dashboardMessage, getFriendlyError(error), 'error');
    }
  }
  if (target.dataset.action === 'delete' && window.confirm('Supprimer définitivement cet article ?')) {
    try {
      await deleteArticle(article.id);
      await loadArticles();
      setMessage(elements.dashboardMessage, 'Article supprimé.', 'success');
    } catch (error) {
      setMessage(elements.dashboardMessage, getFriendlyError(error), 'error');
    }
  }
}

function bindEvents() {
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.newArticleBtn.addEventListener('click', () => openForm());
  elements.cancelButtons.forEach((button) => button.addEventListener('click', closeForm));
  elements.articlesList.addEventListener('click', handleArticleAction);
  elements.articleForm.addEventListener('submit', (event) => {
    event.preventDefault();
    saveArticle();
  });
  elements.saveDraftBtn.addEventListener('click', () => saveArticle('draft'));
  elements.publishBtn.addEventListener('click', () => saveArticle('published'));
  elements.title.addEventListener('input', () => {
    if (!slugTouched) elements.slug.value = generateSlug(elements.title.value);
  });
  elements.slug.addEventListener('input', () => {
    slugTouched = true;
    elements.slug.value = generateSlug(elements.slug.value);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  updateDiagnostics();
  try {
    currentSession = await getSupabaseSession();
    if (currentSession) {
      showDashboard();
      await loadArticles();
    } else {
      showLogin();
    }
  } catch (error) {
    currentSession = null;
    showLogin();
    setMessage(elements.loginMessage, getFriendlyError(error), 'error');
  } finally {
    updateDiagnostics();
  }
});
