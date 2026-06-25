const ALLOWED_TAGS = [
  'h2',
  'h3',
  'h4',
  'p',
  'strong',
  'em',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'br',
  'figure',
  'figcaption',
  'img'
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height', 'loading', 'decoding'];
const ALIGNMENT_CLASSES = new Set(['ag-align-left', 'ag-align-center', 'ag-align-right', 'ag-align-justify']);
const DANGEROUS_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'style', 'form', 'input', 'button']);
const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function hasHtmlMarkup(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

function escapeText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function legacyTextToHtml(value) {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';

  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeText(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function normalizeArticleHtml(value) {
  const html = String(value || '').trim();
  if (!html) return '';
  return hasHtmlMarkup(html) ? html : legacyTextToHtml(html);
}

function isBase64Image(value) {
  return /^data:image\//i.test(String(value || '').trim());
}

function isSafeUrl(value) {
  const urlValue = String(value || '').trim();
  if (!urlValue || urlValue.startsWith('#') || urlValue.startsWith('/')) return true;

  if (isBase64Image(urlValue)) return false;

  try {
    const url = new URL(urlValue, window.location.origin);
    return LINK_PROTOCOLS.has(url.protocol);
  } catch (error) {
    return false;
  }
}

function isSafeLink(value) {
  return isSafeUrl(value);
}

function cleanImages(root) {
  root.querySelectorAll('img').forEach((image) => {
    const src = image.getAttribute('src') || '';
    if (!isSafeUrl(src)) {
      image.remove();
      return;
    }

    image.setAttribute('loading', 'lazy');
    image.setAttribute('decoding', 'async');
    image.removeAttribute('srcset');
  });
}

function hardenLinks(root) {
  root.querySelectorAll('a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!isSafeLink(href)) {
      link.removeAttribute('href');
      link.removeAttribute('target');
      link.removeAttribute('rel');
      return;
    }

    if (/^(https?:)?\/\//i.test(href)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    } else {
      link.removeAttribute('target');
      if (!link.getAttribute('rel')) link.removeAttribute('rel');
    }
  });
}


function getAllowedAttributesForTag(tagName) {
  if (tagName === 'a') return new Set(['href', 'target', 'rel']);
  if (tagName === 'img') return new Set(['src', 'alt', 'width', 'height', 'loading', 'decoding']);
  if (['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'blockquote', 'figure', 'figcaption'].includes(tagName)) return new Set(['class']);
  return new Set();
}

function cleanAllowedAttributes(root) {
  root.querySelectorAll('*').forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    const allowedAttributes = getAllowedAttributesForTag(tagName);

    [...element.attributes].forEach((attribute) => {
      const attrName = attribute.name.toLowerCase();
      if (attrName.startsWith('on') || !allowedAttributes.has(attrName)) {
        element.removeAttribute(attribute.name);
      }
    });
  });
}

function cleanAlignmentClasses(root) {
  root.querySelectorAll('[class]').forEach((element) => {
    const safeClasses = String(element.getAttribute('class') || '')
      .split(/\s+/)
      .filter((className) => ALIGNMENT_CLASSES.has(className));

    if (safeClasses.length) {
      element.setAttribute('class', safeClasses.join(' '));
    } else {
      element.removeAttribute('class');
    }
  });
}

function fallbackSanitize(html) {
  const template = document.createElement('template');
  template.innerHTML = normalizeArticleHtml(html);

  template.content.querySelectorAll('*').forEach((element) => {
    const tagName = element.tagName.toLowerCase();

    if (DANGEROUS_TAGS.has(tagName)) {
      element.remove();
      return;
    }

    if (!ALLOWED_TAGS.includes(tagName)) {
      element.replaceWith(...element.childNodes);
      return;
    }

  });

  cleanAllowedAttributes(template.content);
  hardenLinks(template.content);
  cleanImages(template.content);
  cleanAlignmentClasses(template.content);
  return template.innerHTML.trim();
}

export function sanitizeArticleHtml(html) {
  const normalizedHtml = normalizeArticleHtml(html);
  if (!normalizedHtml) return '';

  const purify = window.DOMPurify;
  if (!purify?.sanitize) return fallbackSanitize(normalizedHtml);

  const sanitizedHtml = purify.sanitize(normalizedHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: [...DANGEROUS_TAGS],
    FORBID_ATTR: ['style'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
  });

  const template = document.createElement('template');
  template.innerHTML = sanitizedHtml;
  cleanAllowedAttributes(template.content);
  hardenLinks(template.content);
  cleanImages(template.content);
  cleanAlignmentClasses(template.content);
  return template.innerHTML.trim();
}

export function hasEmbeddedBase64Image(html) {
  return /<img\b[^>]*\bsrc=["']?data:image\//i.test(String(html || ''));
}

export function getArticleText(html) {
  const template = document.createElement('template');
  template.innerHTML = sanitizeArticleHtml(html);
  return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
}

export function hasReadableArticleContent(html) {
  return getArticleText(html).length > 0;
}
