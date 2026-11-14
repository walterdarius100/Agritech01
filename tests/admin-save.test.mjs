import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';

let writeError, uploadError, refreshError, cleanupError, savedCount = 0, writes = 0, uploads = 0;
const stored = { id: 'id-1', title: 'Titre', slug: 'titre', category: 'Test', status: 'draft' };
const client = {
  storage: { from: () => ({
    async upload() { uploads++; return { error: uploadError }; },
    getPublicUrl: () => ({ data: { publicUrl: 'https://test.invalid/cover.png' } })
  }) },
  from: () => {
    let write = false, single = false;
    const query = {
      insert() { write = true; writes++; savedCount++; return this; },
      update() { write = true; writes++; return this; },
      select() { return this; }, eq() { return this; }, neq() { return this; },
      single() { single = true; return this; }, order() { return this; },
      then(resolve, reject) { return Promise.resolve(write ? { data: stored, error: !single && cleanupError ? cleanupError : writeError } : { data: [stored], error: refreshError }).then(resolve, reject); }
    };
    return query;
  }
};
globalThis.__saveClient = client;
const mock = 'data:text/javascript,' + encodeURIComponent('export const getSupabaseClient = async () => globalThis.__saveClient; export const isSupabaseConfigured = () => true; export const getSupabaseDiagnostics = () => ({});');
const hooks = registerHooks({ resolve(s, c, next) {
  if (s.endsWith('supabase-client.js')) return { url: mock, shortCircuit: true };
  return next(s, c);
} });
const service = await import('../js/services/articles-service.js');
const fields = new Map();
function field() { return { value: '', textContent: '', disabled: false, dataset: {}, checked: false, files: [], hidden: false, setAttribute() {}, removeAttribute() {}, classList: { toggle() {} }, focus() {}, addEventListener() {} }; }
globalThis.document = {
  querySelector(selector) { if (!fields.has(selector)) fields.set(selector, field()); return fields.get(selector); },
  querySelectorAll() { return []; }, addEventListener() {}
};
let content = '<p>Contenu conservé</p>', uploadResult = [], waitUpload;
const editor = { getContent: () => content, save() {}, mode: { set() {} }, uploadImages: async () => { if (waitUpload) await waitUpload; return uploadResult; } };
globalThis.window = { tinymce: { get: () => editor, triggerSave() {} } };
// Use the real admin save path; replace only HTML helpers requiring a browser parser.
const htmlMock = 'data:text/javascript,' + encodeURIComponent(`export const hasEmbeddedBase64Image = s => /data:image/.test(s); export const hasReadableArticleContent = s => s.length > 0; export const sanitizeArticleHtml = s => s;`);
const htmlHooks = registerHooks({ resolve(s, c, next) {
  if (s.endsWith('article-html.js')) return { url: htmlMock, shortCircuit: true };
  return next(s, c);
} });
let source = await readFile(new URL('../js/pages/admin.js', import.meta.url), 'utf8');
source = source.replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, new URL('../js/pages/admin.js', import.meta.url)).href}'`);
source += '\nexport { saveArticle, elements, uploadEditorImageToSupabase };';
const { saveArticle, elements, uploadEditorImageToSupabase } = await import('data:text/javascript,' + encodeURIComponent(source));
const { prepareArticleEditorForSave } = await import('../js/pages/admin-rich-editor.js');
hooks.deregister(); htmlHooks.deregister();
elements.articleForm.querySelectorAll = () => [...fields.values()];
const image = (name = 'photo.png', type = 'image/png', bytes = [137,80,78,71,13,10,26,10]) => new File([new Uint8Array(bytes)], name, { type });
function reset() {
  writeError = uploadError = refreshError = cleanupError = null; savedCount = writes = uploads = 0;
  content = '<p>Contenu conservé</p>'; uploadResult = []; waitUpload = null;
  elements.articleId.value = 'existing'; elements.articleTitle.value = 'Titre';
  elements.articleSlug.value = 'titre'; elements.articleCategory.value = 'Test';
  elements.articlePublishedAt.value = ''; elements.articleImage.value = ''; elements.articleImage.files = [];
}

test('sauvegardes, éditeur et Storage simulés', async t => {
  t.beforeEach(reset);
  await t.test('création simple', async () => { elements.articleId.value = ''; await saveArticle(); assert.equal(savedCount, 1); assert.equal(elements.articleId.value, stored.id); });
  await t.test('double clic et upload encore en cours', async () => {
    let release; waitUpload = new Promise(r => release = r);
    const first = saveArticle(); await saveArticle();
    assert.equal(savedCount, 0); assert.equal(elements.updateButton.disabled, true);
    release(); await first; assert.equal(elements.articleId.value, stored.id); assert.equal(elements.updateButton.disabled, false);
  });
  await t.test('couverture réussie et fichier vidé', async () => { elements.articleImage.files = [image()]; await saveArticle(); assert.equal(uploads, 1); assert.equal(elements.articleImage.value, ''); assert.match(elements.articleCoverUrl.value, /cover.png/); });
  await t.test('échec couverture sans écriture', async () => { uploadError = new Error('Storage indisponible'); elements.articleImage.files = [image()]; await saveArticle(); assert.equal(uploads, 1); assert.equal(writes, 0); assert.equal(elements.articleId.value, 'existing'); assert.match(elements.dashboardMessage.textContent, /image.*envoyée/); });
  await t.test('TinyMCE échoué conserve le contenu', async () => { uploadResult = [{ status: false }]; await saveArticle(); assert.equal(writes, 0); assert.equal(content, '<p>Contenu conservé</p>'); assert.match(elements.dashboardMessage.textContent, /téléversée/); });
  await t.test('URL blob et base64 refusées', async () => { for (const src of ['blob:123', 'data:image/png;base64,AAAA']) { content = `<p>Texte</p><img src="${src}">`; await assert.rejects(prepareArticleEditorForSave(), { code: 'EDITOR_UPLOAD' }); } });
  await t.test('upload interrompu ou trop long', async () => { waitUpload = new Promise(() => {}); await assert.rejects(prepareArticleEditorForSave(5), { code: 'EDITOR_UPLOAD' }); });
  await t.test('SVG, MIME et signature incohérents refusés', async () => { for (const f of [image('a.svg', 'image/svg+xml'), image('a.jpg'), image('a.png', 'image/png', [1,2,3])]) await assert.rejects(service.uploadArticleImage(f, 'test'), { code: 'IMAGE_FORMAT' }); assert.equal(uploads, 0); });
  await t.test('plus de 4 Mio refusé', async () => { await assert.rejects(service.uploadArticleImage(new File([new Uint8Array(4194305)], 'x.png', { type: 'image/png' }), 'test'), { code: 'IMAGE_SIZE' }); });
  await t.test('Blob TinyMCE avec nom séparé accepté', async () => { const file = image(); const url = await uploadEditorImageToSupabase(new Blob([file], {type:file.type}), 'photo.png'); assert.match(url, /cover.png/); assert.equal(uploads, 1); });
  await t.test('JPEG WebP GIF acceptés', async () => { for (const f of [image('a.jpg', 'image/jpeg', [255,216,255]), image('a.webp', 'image/webp', [...Buffer.from('RIFF0000WEBP')]), image('a.gif', 'image/gif', [...Buffer.from('GIF89a')])]) await service.uploadArticleContentImage(f, 'test'); assert.equal(uploads, 3); });
  await t.test('session expirée distinguée', async () => { writeError = { message: 'JWT expired', code: 'PGRST301' }; await saveArticle(); assert.match(elements.dashboardMessage.textContent, /session a expiré/); });
  await t.test('Database après upload conserve URL et contenu', async () => { writeError = { message: 'Database unavailable', code: 'XX000' }; elements.articleImage.files = [image()]; await saveArticle(); assert.equal(uploads, 1); assert.match(elements.dashboardMessage.textContent, /enregistrer/); assert.match(elements.articleCoverUrl.value, /cover.png/); assert.equal(content, '<p>Contenu conservé</p>'); });
  await t.test('modification sans insertion', async () => { await saveArticle(); assert.equal(writes, 1); assert.equal(savedCount, 0); });
  await t.test('échec refresh après création conserve ID pour réessayer', async () => { elements.articleId.value = ''; refreshError = new Error('network'); await saveArticle(); assert.equal(elements.articleId.value, stored.id); assert.match(elements.dashboardMessage.textContent, /Article enregistré/); refreshError = null; await saveArticle(); assert.equal(savedCount, 1); });
  await t.test('échec écriture à la une ne retire aucune autre une', async () => { writeError = {code:'XX000',message:'Database failure'}; await assert.rejects(service.createArticle({...stored,featured:true})); assert.equal(writes, 1); });
  await t.test('échec secondaire à la une conserve article enregistré et ID', async () => { cleanupError = {message:'permission denied'}; elements.articleId.value = ''; elements.articleFeatured.checked = true; await saveArticle(); assert.equal(elements.articleId.value, stored.id); assert.equal(savedCount, 1); assert.match(elements.dashboardMessage.textContent, /Article enregistré/); elements.articleFeatured.checked = false; });
  await t.test('réponse de création perdue : nouvelle insertion bloquée', async () => { elements.articleId.value = ''; writeError = new Error('Failed to fetch'); await saveArticle(); await saveArticle(); assert.equal(savedCount, 1); assert.match(elements.dashboardMessage.textContent, /incertain/); });
});
