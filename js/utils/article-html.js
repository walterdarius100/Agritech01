import { escapeHtml } from './sanitize.js';

const ALLOWED_TAGS = [
  'a', 'blockquote', 'br', 'div', 'em', 'figcaption', 'figure', 'h2', 'h3', 'h4', 'hr',
  'img', 'li', 'ol', 'p', 'strong', 'ul'
];

const ALLOWED_ATTR = ['alt', 'class', 'href', 'rel', 'src', 'target', 'title'];
const ALLOWED_CLASSES = ['article-align-left', 'article-align-center', 'article-align-right'];
const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|\/)/i;

function isSafeUrl(value = '') {
  return SAFE_URL_PATTERN.test(String(value).trim());
}

export function isSafeArticleMediaUrl(value = '') {
  const url = String(value || '').trim();
  return /^(https?:|\/)/i.test(url);
}

function stripUnsafeAttributes(root) {
  root.querySelectorAll('*').forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value || '';
      if (name.startsWith('on') || name === 'style' || !ALLOWED_ATTR.includes(name)) {
        node.removeAttribute(attribute.name);
        return;
      }
      if ((name === 'href' || name === 'src') && !isSafeUrl(value)) {
        node.removeAttribute(attribute.name);
        return;
      }
      if (name === 'class') {
        const safeClasses = value.split(/\s+/).filter((className) => ALLOWED_CLASSES.includes(className));
        if (safeClasses.length) {
          node.setAttribute('class', safeClasses.join(' '));
        } else {
          node.removeAttribute(attribute.name);
        }
      }
    });
  });
}

function hardenArticleLinks(root) {
  root.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!isSafeUrl(href)) {
      link.removeAttribute('href');
      return;
    }

    const normalizedHref = href.trim().toLowerCase();
    let targetUrl;
    try {
      targetUrl = new URL(href, window.location.origin);
    } catch (error) {
      link.removeAttribute('href');
      return;
    }
    const isExternal = targetUrl.origin !== window.location.origin && !normalizedHref.startsWith('mailto:') && !normalizedHref.startsWith('tel:');
    if (isExternal) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    } else {
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  });
}

function hardenArticleImages(root) {
  root.querySelectorAll('img').forEach((image) => {
    const src = image.getAttribute('src') || '';
    if (!isSafeArticleMediaUrl(src)) {
      image.remove();
      return;
    }
    image.setAttribute('loading', 'lazy');
    image.setAttribute('decoding', 'async');
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
  });
}

function fallbackSanitize(html = '') {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');

  template.content.querySelectorAll('*').forEach((node) => {
    if (!ALLOWED_TAGS.includes(node.tagName.toLowerCase())) {
      node.replaceWith(...node.childNodes);
    }
  });

  stripUnsafeAttributes(template.content);
  return template.innerHTML;
}

export function sanitizeArticleHtml(html = '') {
  const dirtyHtml = String(html || '').trim();
  if (!dirtyHtml) return '';

  const purifiedHtml = window.DOMPurify
    ? window.DOMPurify.sanitize(dirtyHtml, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta', 'form', 'input', 'button'],
      FORBID_ATTR: ['style', 'srcset', 'sizes'],
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: true
    })
    : fallbackSanitize(dirtyHtml);

  const template = document.createElement('template');
  template.innerHTML = purifiedHtml;
  stripUnsafeAttributes(template.content);
  hardenArticleLinks(template.content);
  hardenArticleImages(template.content);

  return template.innerHTML.trim();
}

export function renderArticleHtmlForDisplay(content = '') {
  const rawContent = Array.isArray(content) ? content.join('\n\n') : String(content || '');
  const hasHtmlTags = /<\s*[a-z][\s\S]*>/i.test(rawContent);
  if (hasHtmlTags) return sanitizeArticleHtml(rawContent);

  return rawContent
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function getPlainTextFromArticleHtml(html = '') {
  const template = document.createElement('template');
  template.innerHTML = sanitizeArticleHtml(html);
  return template.content.textContent.replace(/\s+/g, ' ').trim();
}
