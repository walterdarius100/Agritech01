import { escapeHtml } from './sanitize.js';

const ALLOWED_TAGS = new Set(['A', 'B', 'BLOCKQUOTE', 'BR', 'DIV', 'EM', 'H2', 'H3', 'HR', 'I', 'LI', 'OL', 'P', 'STRONG', 'UL']);
const BLOCK_TAGS = new Set(['BLOCKQUOTE', 'DIV', 'H2', 'H3', 'LI', 'OL', 'P', 'UL']);
const INLINE_TAG_MAP = {
  B: 'strong',
  I: 'em'
};
const BLOCK_TAG_MAP = {
  DIV: 'p'
};

function isSafeUrl(value) {
  try {
    const url = new URL(String(value || '').trim(), window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch (error) {
    return false;
  }
}

function normalizeLinkUrl(value) {
  const rawUrl = String(value || '').trim();
  if (!rawUrl) return '';
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl) || rawUrl.startsWith('#') || rawUrl.startsWith('/')
    ? rawUrl
    : `https://${rawUrl}`;
  return isSafeUrl(withProtocol) ? withProtocol : '';
}

function sanitizeNode(node, documentRef) {
  if (node.nodeType === Node.TEXT_NODE) return documentRef.createTextNode(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return documentRef.createTextNode('');

  const tagName = node.tagName;
  if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED'].includes(tagName)) return documentRef.createTextNode('');

  if (!ALLOWED_TAGS.has(tagName)) {
    const fragment = documentRef.createDocumentFragment();
    node.childNodes.forEach((child) => fragment.appendChild(sanitizeNode(child, documentRef)));
    return fragment;
  }

  const cleanTagName = INLINE_TAG_MAP[tagName] || BLOCK_TAG_MAP[tagName] || tagName.toLowerCase();
  const element = documentRef.createElement(cleanTagName);

  if (tagName === 'A') {
    const href = normalizeLinkUrl(node.getAttribute('href'));
    if (!href) {
      const fragment = documentRef.createDocumentFragment();
      node.childNodes.forEach((child) => fragment.appendChild(sanitizeNode(child, documentRef)));
      return fragment;
    }
    element.setAttribute('href', href);
    element.setAttribute('rel', 'noopener noreferrer');
    if (/^https?:/i.test(href)) element.setAttribute('target', '_blank');
  }

  node.childNodes.forEach((child) => element.appendChild(sanitizeNode(child, documentRef)));

  if (BLOCK_TAGS.has(tagName) && !element.textContent.trim() && tagName !== 'HR') return documentRef.createTextNode('');
  return element;
}

function normalizeRichHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const fragment = document.createDocumentFragment();
  template.content.childNodes.forEach((node) => fragment.appendChild(sanitizeNode(node, document)));
  const wrapper = document.createElement('div');
  wrapper.appendChild(fragment);
  return wrapper.innerHTML
    .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '')
    .replace(/<div>\s*<\/div>/gi, '')
    .trim();
}

function plainTextToHtml(content) {
  const blocks = String(content || '').split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks.map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('');
}

export function sanitizeArticleContent(content) {
  const rawContent = Array.isArray(content) ? content.join('\n\n') : String(content || '');
  if (!rawContent.trim()) return '';
  return /<\/?[a-z][\s\S]*>/i.test(rawContent) ? normalizeRichHtml(rawContent) : plainTextToHtml(rawContent);
}

export function createSafeArticleLink(url) {
  return normalizeLinkUrl(url);
}
