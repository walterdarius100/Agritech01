import { sanitizeArticleHtml } from '../utils/article-html.js';

const EDITOR_ID = 'articleContentField';
const TINYMCE_TIMEOUT_MS = 5000;

function getTextarea() {
  return document.querySelector(`#${EDITOR_ID}`);
}

function getEditor() {
  return window.tinymce?.get(EDITOR_ID) || null;
}

function waitForTinyMce(timeout = TINYMCE_TIMEOUT_MS) {
  if (window.tinymce?.init) return Promise.resolve(window.tinymce);

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.tinymce?.init) {
        window.clearInterval(timer);
        resolve(window.tinymce);
        return;
      }

      if (Date.now() - startedAt >= timeout) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 80);
  });
}

export async function initArticleEditor({ imagesUploadHandler = null, onUploadError = null } = {}) {
  const textarea = getTextarea();
  if (!textarea) return null;

  const tinymce = await waitForTinyMce();
  if (!tinymce?.init) return null;

  const existingEditor = getEditor();
  if (existingEditor) return existingEditor;

  const editors = await tinymce.init({
    selector: `#${EDITOR_ID}`,
    license_key: 'gpl',
    menubar: false,
    branding: false,
    promotion: false,
    height: 420,
    min_height: 320,
    plugins: 'autolink link lists advlist autoresize preview image',
    toolbar: 'undo redo | blocks | bold italic | bullist numlist blockquote hr | alignleft aligncenter alignright | link image | removeformat preview',
    block_formats: 'Paragraphe=p; Titre H2=h2; Sous-titre H3=h3; Intertitre H4=h4',
    valid_elements: 'h2[class],h3[class],h4[class],p[class],strong/b,em/i,a[href|target|rel],ul[class],ol[class],li,blockquote[class],hr,br,figure[class],figcaption,img[src|alt|width|height|loading|decoding]',
    invalid_elements: 'script,iframe,object,embed,style,form,input,button',
    convert_urls: false,
    automatic_uploads: true,
    images_upload_credentials: false,
    paste_data_images: false,
    image_title: true,
    images_file_types: 'jpg,jpeg,png,webp,gif',
    images_upload_handler: async (blobInfo) => {
      if (typeof imagesUploadHandler !== 'function') {
        throw new Error('Connexion au stockage impossible. Vérifiez votre connexion.');
      }

      try {
        return await imagesUploadHandler(blobInfo.blob(), blobInfo.filename());
      } catch (error) {
        onUploadError?.(error);
        throw new Error(error?.message || 'L’image n’a pas pu être envoyée. Réessayez.');
      }
    },
    default_link_target: '_blank',
    link_assume_external_targets: 'https',
    target_list: [
      { title: 'Nouvelle fenêtre', value: '_blank' },
      { title: 'Même fenêtre', value: '' }
    ],
    rel_list: [
      { title: 'noopener noreferrer', value: 'noopener noreferrer' }
    ],
    formats: {
      alignleft: { selector: 'h2,h3,h4,p,blockquote,ul,ol,figure,figcaption', classes: 'ag-align-left' },
      aligncenter: { selector: 'h2,h3,h4,p,blockquote,ul,ol,figure,figcaption', classes: 'ag-align-center' },
      alignright: { selector: 'h2,h3,h4,p,blockquote,ul,ol,figure,figcaption', classes: 'ag-align-right' }
    },
    content_style: `
      body { color: #14211b; font-family: Inter, Arial, sans-serif; font-size: 16px; line-height: 1.75; }
      h2, h3, h4 { color: #0f3d2e; line-height: 1.2; margin: 1.2em 0 .55em; }
      p { margin: 0 0 1em; }
      blockquote { border-left: 4px solid #228b50; color: #365447; margin: 1.2em 0; padding: .65em 1em; background: #f5fbf6; }
      a { color: #176b48; }
      img { display: block; max-width: 100%; height: auto; margin: 1.4em auto; border-radius: 12px; border: 1px solid #d9e8dd; }
      hr { border: 0; border-top: 1px solid #d9e8dd; margin: 1.6em 0; }
      .ag-align-left { text-align: left; }
      .ag-align-center { text-align: center; }
      .ag-align-right { text-align: right; }
    `,
    setup(editor) {
      editor.on('change keyup undo redo setcontent', () => editor.save());
    }
  });

  return editors?.[0] || getEditor();
}

export function syncArticleEditor() {
  if (window.tinymce?.triggerSave) window.tinymce.triggerSave();
  getEditor()?.save();
}

export function getArticleEditorContent() {
  const editor = getEditor();
  if (editor) return editor.getContent();
  return getTextarea()?.value || '';
}

export function setArticleEditorContent(content = '') {
  const safeContent = sanitizeArticleHtml(content);
  const textarea = getTextarea();
  if (textarea) textarea.value = safeContent;

  const editor = getEditor();
  if (editor) editor.setContent(safeContent);
}
