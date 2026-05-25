#!/usr/bin/env node
import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';
import {
  decodeEntities,
  fetchJson,
  LIVE_ORIGIN,
  normalizePath,
  projectPath,
  slugify,
  stripHtml,
  writeTextFile,
} from './lib.mjs';

const apiRoot = `${LIVE_ORIGIN}/wp-json/wp/v2`;
const postLimit = Number(process.env.WP_IMPORT_LIMIT || 50);
const pageLimit = Number(process.env.WP_PAGE_IMPORT_LIMIT || 50);
const exportFile = process.env.WP_EXPORT_FILE;

if (exportFile) {
  const payload = JSON.parse(await readFile(exportFile, 'utf8'));
  await Promise.all([
    ...(payload.posts || []).map((post) => writeExportEntry(post, 'post')),
    ...(payload.pages || []).map((page) => writeExportEntry(page, 'page')),
  ]);
  console.log(`Imported ${(payload.posts || []).length} posts and ${(payload.pages || []).length} pages from ${exportFile}.`);
} else {
  const [categories, tags, users] = await Promise.all([
    safeFetchAll(`${apiRoot}/categories`, 100, 'categories'),
    safeFetchAll(`${apiRoot}/tags`, 100, 'tags'),
    safeFetchAll(`${apiRoot}/users`, 100, 'users'),
  ]);

  const categoryMap = new Map(categories.map((term) => [term.id, term]));
  const tagMap = new Map(tags.map((term) => [term.id, term]));
  const userMap = new Map(users.map((user) => [user.id, user]));

  const [posts, pages] = await Promise.all([
    fetchJson(`${apiRoot}/posts?per_page=${postLimit}&_embed=1&orderby=date&order=desc`),
    fetchJson(`${apiRoot}/pages?per_page=${pageLimit}&_embed=1&orderby=date&order=desc`),
  ]);

  await Promise.all([
    ...posts.map((post) => writeRestEntry(post, 'post', { categoryMap, tagMap, userMap })),
    ...pages.map((page) => writeRestEntry(page, 'page', { categoryMap, tagMap, userMap })),
  ]);

  console.log(`Imported ${posts.length} posts and ${pages.length} pages from WordPress.`);
}

async function fetchAll(endpoint, perPage) {
  const results = [];
  for (let page = 1; page < 20; page += 1) {
    const batch = await fetchJson(`${endpoint}?per_page=${perPage}&page=${page}`);
    results.push(...batch);
    if (batch.length < perPage) break;
  }
  return results;
}

async function safeFetchAll(endpoint, perPage, label) {
  try {
    return await fetchAll(endpoint, perPage);
  } catch (error) {
    console.warn(`Warning: could not fetch WordPress ${label}: ${error.message}`);
    return [];
  }
}

async function writeRestEntry(item, type, maps) {
  const { categoryMap, tagMap, userMap } = maps;
  const collection = type === 'post' ? 'posts' : 'pages';
  const outputPath = projectPath('src', 'content', collection, `${safeFileName(item)}.md`);
  const embeddedAuthor = item._embedded?.author?.[0];
  const author = userMap.get(item.author) || embeddedAuthor;
  const media = item._embedded?.['wp:featuredmedia']?.[0];
  const categoryTerms = (item.categories || []).map((id) => categoryMap.get(id)).filter(Boolean);
  const tagTerms = (item.tags || []).map((id) => tagMap.get(id)).filter(Boolean);
  const path = normalizePath(item.link);
  const seo = extractSeo(item, path);
  const frontmatter = {
    id: item.id,
    type,
    wpSlug: item.slug || slugify(path),
    path,
    url: item.link,
    title: decodeEntities(item.title?.rendered || item.slug),
    excerpt: item.excerpt?.rendered || '',
    date: item.date_gmt ? `${item.date_gmt}Z` : item.date,
    modified: item.modified_gmt ? `${item.modified_gmt}Z` : item.modified,
    author: author?.name || '',
    authorSlug: author?.slug || '',
    categories: categoryTerms.map((term) => decodeEntities(term.name)),
    categorySlugs: categoryTerms.map((term) => term.slug),
    tags: tagTerms.map((term) => decodeEntities(term.name)),
    tagSlugs: tagTerms.map((term) => term.slug),
    featuredImage: localMediaPath(media?.source_url),
    featuredImageAlt: decodeEntities(media?.alt_text || media?.title?.rendered || ''),
    seo,
  };
  const body = item.content?.rendered || '';
  await writeTextFile(outputPath, `---\n${toYaml(frontmatter)}---\n\n${body}\n`);
}

async function writeExportEntry(item, type) {
  const collection = type === 'post' ? 'posts' : 'pages';
  const outputPath = projectPath('src', 'content', collection, `${safeFileName(item)}.md`);
  const path = normalizePath(item.path || item.url);
  const frontmatter = {
    id: item.id,
    type,
    wpSlug: item.slug || slugify(path),
    path,
    url: new URL(path, LIVE_ORIGIN).toString(),
    title: decodeEntities(item.title || item.slug || path),
    excerpt: item.excerpt || '',
    date: item.date,
    modified: item.modified,
    author: item.author?.name || '',
    authorSlug: item.author?.slug || '',
    categories: (item.categories || []).map((term) => decodeEntities(term.name)),
    categorySlugs: (item.categories || []).map((term) => term.slug),
    tags: (item.tags || []).map((term) => decodeEntities(term.name)),
    tagSlugs: (item.tags || []).map((term) => term.slug),
    featuredImage: localMediaPath(item.featuredImage),
    featuredImageAlt: decodeEntities(item.featuredImageAlt || ''),
    seo: {
      title: decodeEntities(item.seo?.title || item.title || ''),
      description: decodeEntities(item.seo?.description || stripHtml(item.excerpt || '')),
      canonical: normalizeLiveUrl(item.seo?.canonical) || new URL(path, LIVE_ORIGIN).toString(),
    },
  };
  await writeTextFile(outputPath, `---\n${toYaml(frontmatter)}---\n\n${localizeBodyMedia(item.content || '')}\n`);
}

function safeFileName(item) {
  const pathName = normalizePath(item.link).replace(/^\/|\/$/g, '').replace(/\//g, '--');
  return slugify(pathName || basename(item.slug || `wordpress-${item.id}`));
}

function extractSeo(item, path) {
  const yoast = item.yoast_head_json || {};
  const rankMath = item.rank_math || {};
  return {
    title: decodeEntities(yoast.title || rankMath.title || item.title?.rendered || ''),
    description: decodeEntities(yoast.description || rankMath.description || stripHtml(item.excerpt?.rendered || '')),
    canonical: yoast.canonical || new URL(path, LIVE_ORIGIN).toString(),
    schema: yoast.schema || undefined,
  };
}

function normalizeLiveUrl(url) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, LIVE_ORIGIN);
    return new URL(parsed.pathname + parsed.search + parsed.hash, LIVE_ORIGIN).toString();
  } catch {
    return url;
  }
}

function normalizeBodyUrls(html) {
  return html
    .replace(/https:\/\/staging-electrikjam\.kinsta\.cloud/g, LIVE_ORIGIN)
    .replace(/http:\/\/staging-electrikjam\.kinsta\.cloud/g, LIVE_ORIGIN);
}

function localMediaPath(url) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, LIVE_ORIGIN);
    if (parsed.pathname.startsWith('/wp-content/uploads/')) {
      return parsed.pathname;
    }
    return normalizeLiveUrl(url);
  } catch {
    return url;
  }
}

function localizeBodyMedia(html) {
  return normalizeBodyUrls(html)
    .replace(/https:\/\/www\.electrikjam\.com\/wp-content\/uploads/g, '/wp-content/uploads')
    .replace(/http:\/\/www\.electrikjam\.com\/wp-content\/uploads/g, '/wp-content/uploads')
    .replace(/https:\/\/staging-electrikjam\.kinsta\.cloud\/wp-content\/uploads/g, '/wp-content/uploads')
    .replace(/http:\/\/staging-electrikjam\.kinsta\.cloud\/wp-content\/uploads/g, '/wp-content/uploads');
}

function toYaml(value, indent = 0) {
  return Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([key, entryValue]) => `${' '.repeat(indent)}${key}: ${yamlValue(entryValue, indent)}`)
    .join('\n') + '\n';
}

function yamlValue(value, indent) {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `\n${value.map((item) => `${' '.repeat(indent + 2)}- ${yamlScalar(item)}`).join('\n')}`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
    if (entries.length === 0) return '{}';
    return `\n${entries.map(([key, entryValue]) => `${' '.repeat(indent + 2)}${key}: ${yamlValue(entryValue, indent + 2).trimStart()}`).join('\n')}`;
  }
  return yamlScalar(value);
}

function yamlScalar(value) {
  if (value == null) return '""';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(String(value));
}
