import { sanitizeArticleHtml } from '../utils/article-html.js';

const EDITOR_SELECTOR = '#articleContentField';
const EDITOR_PLUGINS = 'autolink lists link image charmap preview anchor searchreplace visualblocks code fullscreen insertdatetime table help wordcount';
const EDITOR_TOOLBAR = [
  'undo redo | blocks | bold italic blockquote | alignleft aligncenter alignright',
  'bullist numlist | link image | hr removeformat | preview code fullscreen'
].join(' | ');

let editorReadyPromise = null;

function getEditor() {
  return window.tinymce?.get('articleContentField') || null;
}

export function initArticleEditor() {
  if (editorReadyPromise) return editorReadyPromise;

  if (!window.tinymce) {
    console.warn('[Agri-tech admin] TinyMCE indisponible : le champ texte natif reste actif.');
    return Promise.resolve(null);
  }

  editorReadyPromise = window.tinymce.init({
    selector: EDITOR_SELECTOR,
    menubar: false,
    branding: false,
    promotion: false,
    height: 520,
    language: 'fr_FR',
    plugins: EDITOR_PLUGINS,
    toolbar: EDITOR_TOOLBAR,
    block_formats: 'Paragraphe=p; Titre=h2; Sous-titre=h3; Intertitre=h4',
    invalid_elements: 'script,iframe,object,embed,style,link,meta,form,input,button',
    valid_elements: 'p[class],br,strong/b,em/i,blockquote[class],ul,ol,li,h2[class],h3[class],h4[class],hr,a[href|target|rel|title],img[src|alt|title],figure,figcaption,div[class]',
    extended_valid_elements: 'a[href|target|rel|title],img[src|alt|title|loading|decoding]',
    formats: {
      alignleft: { selector: 'p,h2,h3,h4,blockquote,div', classes: 'article-align-left' },
      aligncenter: { selector: 'p,h2,h3,h4,blockquote,div', classes: 'article-align-center' },
      alignright: { selector: 'p,h2,h3,h4,blockquote,div', classes: 'article-align-right' }
    },
    automatic_uploads: false,
    paste_data_images: false,
    image_advtab: false,
    image_dimensions: false,
    file_picker_types: 'image',
    images_file_types: '',
    convert_urls: false,
    default_link_target: '_blank',
    link_assume_external_targets: 'https',
    rel_list: [{ title: 'noopener noreferrer', value: 'noopener noreferrer' }],
    content_style: `
      body { font-family: Inter, system-ui, sans-serif; color: #14211b; line-height: 1.75; }
      h2, h3, h4 { color: #0f3d2e; letter-spacing: -0.02em; }
      blockquote { border-left: 4px solid #176b48; margin: 1.2rem 0; padding: .4rem 1rem; background: #f4fbf6; }
      img { max-width: 100%; height: auto; border-radius: 14px; }
    `,
    setup(editor) {
      editor.on('GetContent', (event) => {
        if (event.content) event.content = sanitizeArticleHtml(event.content);
      });
      editor.on('change keyup undo redo setcontent', () => editor.save());
    }
  }).then((editors) => editors[0] || null);

  return editorReadyPromise;
}

export function setArticleEditorContent(html = '') {
  const safeHtml = sanitizeArticleHtml(html);
  const editor = getEditor();
  if (editor) editor.setContent(safeHtml);
  const textarea = document.querySelector(EDITOR_SELECTOR);
  if (textarea) textarea.value = safeHtml;
}

export function getArticleEditorContent() {
  const editor = getEditor();
  const html = editor ? editor.getContent() : document.querySelector(EDITOR_SELECTOR)?.value || '';
  const safeHtml = sanitizeArticleHtml(html);
  if (editor) editor.setContent(safeHtml);
  const textarea = document.querySelector(EDITOR_SELECTOR);
  if (textarea) textarea.value = safeHtml;
  return safeHtml;
}

export function syncArticleEditor() {
  getEditor()?.save();
}
