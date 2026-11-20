import { PROJECT_PHOTO_BUCKET, projectPhotoPath, signProjectPhotos } from '../services/projects-service.js';
import { resizeProjectPhoto } from '../utils/project-image.js';
import { escapeHtml } from '../utils/sanitize.js';

const TEXT_FIELDS = ['title', 'summary', 'details', 'location', 'period', 'domain'];
const PHOTO_LABELS = ['Photo principale', 'Photo complémentaire 1', 'Photo complémentaire 2', 'Photo complémentaire 3'];

export function initProjectAdmin(getClient) {
  const form = document.querySelector('#projectForm');
  if (!form) return null;

  const fields = document.querySelector('#projectFields');
  const photoFields = document.querySelector('#projectPhotoFields');
  const list = document.querySelector('#adminProjectsList');
  const status = document.querySelector('#projectAdminStatus');
  const add = document.querySelector('#newProject');
  let projects = [];
  let editing = null;
  let pending = false;
  let generation = 0;

  photoFields.innerHTML = PHOTO_LABELS.map((label, index) => `
    <fieldset class="form-block project-admin-photo">
      <legend>${label}</legend>
      <img alt="" width="160" height="100" hidden>
      <p class="project-photo-current" hidden>Photo enregistrée</p>
      <label for="projectPhoto${index}">Importer ou remplacer</label>
      <input id="projectPhoto${index}" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="projectPhotoHelp">
      <label for="projectAlt${index}">Texte alternatif</label>
      <input id="projectAlt${index}" maxlength="180">
      <label class="checkbox-row" hidden><input id="projectRemove${index}" type="checkbox"> Retirer la photo actuelle</label>
    </fieldset>`).join('');

  const slots = [...photoFields.children].map(slot => ({
    preview: slot.querySelector('img'),
    current: slot.querySelector('p'),
    file: slot.querySelector('input[type=file]'),
    alt: slot.querySelector('input:not([type])'),
    remove: slot.querySelector('input[type=checkbox]')
  }));

  function message(text, type = 'info') {
    status.textContent = text;
    status.dataset.type = type;
  }

  function setBusy(value) {
    pending = value;
    fields.disabled = value;
    add.disabled = value;
    list.querySelectorAll('button').forEach(button => { button.disabled = value; });
  }

  function closeForm() {
    form.reset();
    form.hidden = true;
    editing = null;
    slots.forEach(slot => {
      slot.preview.hidden = true;
      slot.preview.removeAttribute('src');
    });
  }

  async function showForm(project = null) {
    closeForm();
    const record = { project, id: project?.id || crypto.randomUUID(), uploaded: new Map() };
    editing = record;
    document.querySelector('#projectFormTitle').textContent = project ? 'Modifier le projet' : 'Nouveau projet';
    for (const field of TEXT_FIELDS) form.elements[field].value = project?.[field] || '';
    form.elements.visibility.value = project?.published_at ? 'published' : 'draft';
    slots.forEach((slot, index) => {
      const photo = project?.photos[index];
      slot.alt.value = photo?.alt || '';
      slot.current.hidden = !photo;
      slot.remove.parentElement.hidden = !photo;
    });
    form.hidden = false;
    form.elements.title.focus();
    if (project?.photos.length) {
      const urls = await signProjectPhotos(project.photos.map(photo => ({ id: project.id, photo })), 640, getClient()).catch(() => []);
      if (editing !== record) return;
      urls.forEach((url, index) => {
        if (!url) return;
        slots[index].preview.src = url;
        slots[index].preview.hidden = false;
      });
    }
  }

  function renderList() {
    list.innerHTML = projects.map(project => `
      <article class="admin-article-item">
        <div>
          <span class="status-badge ${project.published_at ? 'status-published' : 'status-draft'}">${project.published_at ? 'Publié' : 'Brouillon'}</span>
          <h4>${escapeHtml(project.title)}</h4>
        </div>
        <div class="article-item-actions">
          <button class="btn mini secondary" type="button" data-edit-project="${project.id}">Modifier</button>
          <button class="btn mini danger" type="button" data-delete-project="${project.id}">Supprimer</button>
        </div>
      </article>`).join('') || '<p class="empty-state">Aucun projet enregistré.</p>';
  }

  async function loadList(client, token) {
    const rows = [];
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client.from('projects').select('*')
        .order('updated_at', { ascending: false }).order('id').range(offset, offset + pageSize - 1);
      if (token !== generation) return;
      if (error) throw error;
      rows.push(...data);
      if (data.length < pageSize) break;
    }
    projects = rows;
    renderList();
  }

  async function open() {
    const client = getClient();
    if (!client || pending) return;
    const token = generation;
    setBusy(true);
    message('Vérification de l’accès et chargement des projets…');
    try {
      const { data, error } = await client.rpc('is_project_admin');
      if (token !== generation) return;
      if (error) throw error;
      if (!data) {
        add.hidden = true;
        closeForm();
        list.replaceChildren();
        message('Ce compte n’est pas autorisé à gérer les projets.', 'error');
        return;
      }
      await loadList(client, token);
      if (token !== generation) return;
      add.hidden = false;
      message('');
    } catch {
      if (token === generation) message('La gestion des projets est momentanément indisponible.', 'error');
    } finally {
      if (token === generation) setBusy(false);
    }
  }

  async function uploadPhoto(client, record, file) {
    // Reuse immutable paths on retry once both uploads have succeeded.
    if (record.uploaded.has(file)) return record.uploaded.get(file);
    const key = crypto.randomUUID();
    const bucket = client.storage.from(PROJECT_PHOTO_BUCKET);
    for (const { width, blob } of await resizeProjectPhoto(file)) {
      const { error } = await bucket.upload(projectPhotoPath(record.id, key, width), blob, {
        contentType: 'image/webp', cacheControl: '60', upsert: false
      });
      if (error) throw error;
    }
    record.uploaded.set(file, key);
    return key;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const client = getClient();
    const record = editing;
    if (!client || !record || pending) return;
    const token = generation;
    const payload = Object.fromEntries(TEXT_FIELDS.map(field => [field, form.elements[field].value.trim()]));
    const published = form.elements.visibility.value === 'published';
    if (!payload.title || (published && (!payload.summary || !payload.details))) {
      message('Renseignez le titre et, pour publier, les deux descriptions.', 'error');
      return;
    }
    const photos = slots.flatMap((slot, index) => {
      const file = slot.file.files[0];
      const current = slot.remove.checked ? null : record.project?.photos[index];
      return file || current ? [{ file, current, alt: slot.alt.value.trim(), altInput: slot.alt }] : [];
    });
    const missingAlt = photos.find(photo => !photo.alt);
    if (missingAlt) {
      message('Ajoutez un texte alternatif à chaque photo conservée.', 'error');
      missingAlt.altInput.focus();
      return;
    }

    setBusy(true);
    message('Enregistrement du projet…');
    let saving = false;
    try {
      payload.photos = [];
      for (const { file, current, alt } of photos) {
        const key = file ? await uploadPhoto(client, record, file) : current.key;
        if (token !== generation) return;
        payload.photos.push({ key, alt });
      }
      payload.published_at = published ? record.project?.published_at || new Date().toISOString() : null;
      saving = true;
      const query = client.from('projects');
      const { data, error } = await (record.project
        ? query.update(payload).eq('id', record.id).eq('updated_at', record.project.updated_at)
        : query.insert({ id: record.id, ...payload })).select('id').maybeSingle();
      if (token !== generation) return;
      if (error) throw error;
      if (!data) {
        message('Ce projet a changé ou vos droits ont été retirés. Copiez vos modifications avant de rouvrir le projet.', 'error');
        return;
      }
      closeForm();
      try {
        await loadList(client, token);
        if (token === generation) message('Projet enregistré.', 'success');
      } catch {
        if (token === generation) message('Projet enregistré. Rouvrez l’onglet pour actualiser la liste.', 'success');
      }
    } catch (error) {
      if (token !== generation) return;
      const text = saving
        ? 'Impossible de confirmer l’enregistrement. Vérifiez la liste avant de réessayer.'
        : error instanceof Error ? error.message : 'Impossible d’importer la photo. Vérifiez le fichier et réessayez.';
      message(text, 'error');
    } finally {
      if (token === generation) {
        setBusy(false);
        if (form.hidden) add.focus();
      }
    }
  });

  add.addEventListener('click', () => { if (!pending) void showForm(); });
  document.querySelector('#cancelProject').addEventListener('click', () => { closeForm(); add.focus(); });
  list.addEventListener('click', async event => {
    const client = getClient();
    const button = event.target.closest('button');
    if (pending || !client || !button) return;
    const project = projects.find(item => item.id === (button.dataset.editProject || button.dataset.deleteProject));
    if (!project) return;
    if (button.dataset.editProject) {
      void showForm(project);
      return;
    }
    if (!confirm(`Supprimer définitivement « ${project.title} » ?`)) return;
    const token = generation;
    setBusy(true);
    let deleted = false;
    try {
      const { data, error } = await client.from('projects').delete()
        .eq('id', project.id).eq('updated_at', project.updated_at).select('id').maybeSingle();
      if (token !== generation) return;
      if (error || !data) throw error || new Error();
      deleted = true;
      if (editing?.id === project.id) closeForm();
      await loadList(client, token);
      if (token === generation) message('Projet supprimé.', 'success');
    } catch {
      if (token === generation) message(deleted
        ? 'Projet supprimé. Rouvrez l’onglet pour actualiser la liste.'
        : 'Suppression non confirmée. Rouvrez l’onglet pour vérifier la liste.', deleted ? 'success' : 'error');
    } finally {
      if (token === generation) setBusy(false);
    }
  });

  return {
    open,
    reset() {
      generation += 1;
      projects = [];
      list.replaceChildren();
      add.hidden = true;
      closeForm();
      setBusy(false);
      message('');
    }
  };
}
