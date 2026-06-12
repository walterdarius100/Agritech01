import { escapeHtml } from './sanitize.js';

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

function isSafeRelativeUrl(value) {
  return value.startsWith('/')
    || value.startsWith('./')
    || value.startsWith('../')
    || value.startsWith('#')
    || !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

function sanitizeMarkdownUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';

  try {
    const parsedUrl = new URL(url, window.location.origin);
    if (ALLOWED_URL_PROTOCOLS.has(parsedUrl.protocol) || isSafeRelativeUrl(url)) return url;
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
    const href = sanitizeMarkdownUrl(match[2]);

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
