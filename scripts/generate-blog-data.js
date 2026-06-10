#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const contentDir = path.join(rootDir, 'content', 'actualites');
const outputFile = path.join(rootDir, 'data', 'blog-posts.json');
const requiredFields = ['title', 'slug', 'excerpt', 'category', 'type', 'date', 'author', 'featured', 'published'];

function parseScalar(value) {
  const trimmed = String(value ?? '').trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return trimmed;
}

function parseFrontMatter(source, filePath) {
  const normalized = source.replace(/^\uFEFF/, '');
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${filePath} ne contient pas de front matter valide.`);
  }

  const data = {};
  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    data[key] = parseScalar(value);
  }

  return { data, body: match[2].trim() };
}

function stripMarkdownInline(value) {
  return String(value ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .trim();
}

function markdownToContent(markdown) {
  return String(markdown ?? '')
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block
      .split(/\r?\n/)
      .map((line) => line.replace(/^#{1,6}\s+/, '').replace(/^[-*+]\s+/, '').replace(/^>\s?/, '').trim())
      .filter(Boolean)
      .join(' '))
    .map(stripMarkdownInline)
    .filter(Boolean);
}

function normalizeDate(value) {
  const date = String(value ?? '').trim();
  const match = date.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : date;
}

function validatePost(post, filePath) {
  const missing = requiredFields.filter((field) => post[field] === undefined || post[field] === '');
  if (missing.length) {
    throw new Error(`${filePath} est incomplet. Champs manquants: ${missing.join(', ')}.`);
  }
  if (Number.isNaN(new Date(`${post.date}T00:00:00`).getTime())) {
    throw new Error(`${filePath} contient une date invalide: ${post.date}.`);
  }
}

function buildPost(fileName) {
  const filePath = path.join(contentDir, fileName);
  const source = fs.readFileSync(filePath, 'utf8');
  const { data, body } = parseFrontMatter(source, filePath);
  const post = {
    slug: String(data.slug || path.basename(fileName, path.extname(fileName))).trim(),
    title: String(data.title || '').trim(),
    excerpt: String(data.excerpt || '').trim(),
    category: String(data.category || '').trim(),
    type: String(data.type || '').trim(),
    date: normalizeDate(data.date),
    author: String(data.author || '').trim(),
    cover: String(data.cover || '').trim(),
    featured: data.featured === true,
    published: data.published !== false,
    content: markdownToContent(body)
  };

  validatePost(post, filePath);
  return post;
}

function main() {
  if (!fs.existsSync(contentDir)) {
    throw new Error(`Dossier introuvable: ${contentDir}`);
  }

  const posts = fs.readdirSync(contentDir)
    .filter((fileName) => fileName.endsWith('.md'))
    .map(buildPost)
    .sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`));

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(posts, null, 2)}\n`, 'utf8');
  console.log(`Generated ${path.relative(rootDir, outputFile)} from ${posts.length} Markdown article(s).`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
