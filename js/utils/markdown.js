import { escapeHtml } from './sanitize.js';

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const ALLOWED_ARTICLE_TAGS = new Set(['h2', 'h3', 'p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br']);
const DANGEROUS_CONTAINER_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'svg', 'math']);

function isSafeRelativeUrl(value) {
  return value.startsWith('/')
    || value.startsWith('./')
    || value.startsWith('../')
    || value.startsWith('#')
    || !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

export function sanitizeArticleUrl(value) {
  const url = String(value || '').trim();
  if (!url || /[\u0000-\u001F<>"']/.test(url)) return '';

  try {
    const parsedUrl = new URL(url, window.location.origin);
    if (SAFE_LINK_PROTOCOLS.has(parsedUrl.protocol) || isSafeRelativeUrl(url)) return url;
  } catch (error) {
    if (isSafeRelativeUrl(url)) return url;
  }

  return '';
}

function renderEmphasis(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
}

function renderInlineMarkdown(value) {
  const source = String(value || '');
  const linkPattern = /\[([^\]\n]+)]\(([^\s)]+)\)/g;
  let rendered = '';
  let lastIndex = 0;
  let match;

  while ((match = linkPattern.exec(source)) !== null) {
    rendered += renderEmphasis(source.slice(lastIndex, match.index));
    const label = renderEmphasis(match[1]);
    const href = sanitizeArticleUrl(match[2]);

    if (href) {
      rendered += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    } else {
      rendered += renderEmphasis(match[0]);
    }

    lastIndex = linkPattern.lastIndex;
  }

  rendered += renderEmphasis(source.slice(lastIndex));
  return rendered;
}

function consumeList(lines, startIndex, ordered = false) {
  const items = [];
  let index = startIndex;
  const pattern = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*]\s+(.+)$/;

  while (index < lines.length) {
    const match = lines[index].match(pattern);
    if (!match) break;
    items.push(`<li>${renderInlineMarkdown(match[1])}</li>`);
    index += 1;
  }

  return {
    html: `<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`,
    nextIndex: index
  };
}

function consumeQuote(lines, startIndex) {
  const parts = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = lines[index].match(/^\s*>\s?(.*)$/);
    if (!match) break;
    parts.push(match[1]);
    index += 1;
  }

  return {
    html: `<blockquote><p>${renderInlineMarkdown(parts.join(' '))}</p></blockquote>`,
    nextIndex: index
  };
}

function consumeParagraph(lines, startIndex) {
  const parts = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) break;
    if (/^\s*#{2,3}\s+/.test(line) || /^\s*---+\s*$/.test(line) || /^\s*>\s?/.test(line) || /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) break;
    parts.push(line.trim());
    index += 1;
  }

  return {
    html: `<p>${renderInlineMarkdown(parts.join(' '))}</p>`,
    nextIndex: index
  };
}

export function renderSafeMarkdown(value) {
  const source = Array.isArray(value) ? value.join('\n\n') : String(value || '');
  const normalized = source.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2 && !trimmed.startsWith('###')) {
      blocks.push(`<h2>${renderInlineMarkdown(h2[1])}</h2>`);
      index += 1;
      continue;
    }

    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      blocks.push(`<h3>${renderInlineMarkdown(h3[1])}</h3>`);
      index += 1;
      continue;
    }

    if (/^---+\s*$/.test(trimmed)) {
      blocks.push('<hr>');
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = consumeQuote(lines, index);
      blocks.push(quote.html);
      index = quote.nextIndex;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const list = consumeList(lines, index, false);
      blocks.push(list.html);
      index = list.nextIndex;
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const list = consumeList(lines, index, true);
      blocks.push(list.html);
      index = list.nextIndex;
      continue;
    }

    const paragraph = consumeParagraph(lines, index);
    blocks.push(paragraph.html);
    index = paragraph.nextIndex;
  }

  return blocks.join('');
}

function appendSanitizedChildren(sourceNode, targetNode) {
  Array.from(sourceNode.childNodes).forEach((childNode) => {
    const cleanChild = sanitizeArticleNode(childNode);
    if (cleanChild) targetNode.appendChild(cleanChild);
  });
}

function sanitizeArticleNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tagName = node.tagName.toLowerCase();
  if (DANGEROUS_CONTAINER_TAGS.has(tagName)) return null;

  if (tagName === 'b') {
    const strong = document.createElement('strong');
    appendSanitizedChildren(node, strong);
    return strong;
  }

  if (tagName === 'i') {
    const em = document.createElement('em');
    appendSanitizedChildren(node, em);
    return em;
  }

  if (tagName === 'div') {
    const paragraph = document.createElement('p');
    appendSanitizedChildren(node, paragraph);
    return paragraph.textContent.trim() || paragraph.querySelector('br') ? paragraph : null;
  }

  if (tagName === 'h1') {
    const heading = document.createElement('h2');
    appendSanitizedChildren(node, heading);
    return heading;
  }

  if (!ALLOWED_ARTICLE_TAGS.has(tagName)) {
    const fragment = document.createDocumentFragment();
    appendSanitizedChildren(node, fragment);
    return fragment;
  }

  const cleanElement = document.createElement(tagName);
  if (tagName === 'a') {
    const safeHref = sanitizeArticleUrl(node.getAttribute('href') || '');
    if (!safeHref) {
      const fragment = document.createDocumentFragment();
      appendSanitizedChildren(node, fragment);
      return fragment;
    }
    cleanElement.setAttribute('href', safeHref);
    cleanElement.setAttribute('target', '_blank');
    cleanElement.setAttribute('rel', 'noopener noreferrer');
  }

  if (tagName !== 'br' && tagName !== 'hr') appendSanitizedChildren(node, cleanElement);
  return cleanElement;
}

export function sanitizeArticleHtml(html) {
  const source = String(html || '').trim();
  if (!source) return '';
  if (typeof document === 'undefined') return escapeHtml(source);

  const template = document.createElement('template');
  template.innerHTML = source;
  const output = document.createElement('div');
  appendSanitizedChildren(template.content, output);
  return output.innerHTML;
}

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

export function renderSafeArticleContent(value) {
  const source = Array.isArray(value) ? value.join('\n\n') : String(value || '');
  const html = looksLikeHtml(source) ? source : renderSafeMarkdown(source);
  return sanitizeArticleHtml(html);
}
