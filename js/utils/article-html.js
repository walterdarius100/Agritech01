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
  'figcaption'
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];
const ALIGNMENT_CLASSES = new Set(['ag-align-left', 'ag-align-center', 'ag-align-right']);
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

function isSafeLink(value) {
  const href = String(value || '').trim();
  if (!href || href.startsWith('#') || href.startsWith('/')) return true;

  try {
    const url = new URL(href, window.location.origin);
    return LINK_PROTOCOLS.has(url.protocol);
  } catch (error) {
    return false;
  }
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

    [...element.attributes].forEach((attribute) => {
      const attrName = attribute.name.toLowerCase();
      if (attrName.startsWith('on') || !ALLOWED_ATTR.includes(attrName)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  hardenLinks(template.content);
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
  hardenLinks(template.content);
  cleanAlignmentClasses(template.content);
  return template.innerHTML.trim();
}

export function getArticleText(html) {
  const template = document.createElement('template');
  template.innerHTML = sanitizeArticleHtml(html);
  return (template.content.textContent || '').replace(/\s+/g, ' ').trim();
}

export function hasReadableArticleContent(html) {
  return getArticleText(html).length > 0;
}
