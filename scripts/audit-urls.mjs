#!/usr/bin/env node
import {
  discoverSitemapUrls,
  extractCanonical,
  extractLinks,
  extractMeta,
  extractTag,
  fetchText,
  LIVE_ORIGIN,
  normalizePath,
  projectPath,
  stripHtml,
  toCsv,
  writeTextFile,
} from './lib.mjs';
import { readFile } from 'node:fs/promises';

const limit = Number(process.env.AUDIT_LIMIT || 200);
const exportFile = process.env.WP_EXPORT_FILE;
const rows = exportFile
  ? await inventoryFromExport(exportFile)
  : [];

if (!exportFile) {
  const urls = (await discoverSitemapUrls(LIVE_ORIGIN)).slice(0, limit);
  for (const oldUrl of urls) {
    const row = await auditUrl(oldUrl);
    rows.push(row);
    console.log(`${row.status_code} ${row.path}`);
  }
}

const columns = [
  'old_url',
  'path',
  'type',
  'status_code',
  'title',
  'h1',
  'canonical',
  'meta_description',
  'word_count',
  'internal_links_count',
  'notes',
];

await writeTextFile(projectPath('url-inventory.csv'), toCsv(rows, columns));
console.log(`Wrote url-inventory.csv with ${rows.length} rows.`);

async function inventoryFromExport(path) {
  const payload = JSON.parse(await readFile(path, 'utf8'));
  const contentRows = [...(payload.posts || []), ...(payload.pages || [])].map((item) => {
    const urlPath = normalizePath(item.path || item.url);
    return {
      old_url: new URL(urlPath, LIVE_ORIGIN).toString(),
      path: urlPath,
      type: item.type === 'page' ? 'page' : 'post',
      status_code: 200,
      title: item.seo?.title || item.title || '',
      h1: item.title || '',
      canonical: item.seo?.canonical || new URL(urlPath, LIVE_ORIGIN).toString(),
      meta_description: item.seo?.description || stripHtml(item.excerpt || ''),
      word_count: stripHtml(item.content || '').split(/\s+/).filter(Boolean).length,
      internal_links_count: new Set(extractLinks(item.content || '', LIVE_ORIGIN).filter((url) => new URL(url).origin === LIVE_ORIGIN)).size,
      notes: 'from_wordpress_export',
    };
  });

  const taxonomyRows = [
    ...(payload.categories || []).map((term) => taxonomyRow(term, 'category')),
    ...(payload.tags || []).map((term) => taxonomyRow(term, 'tag')),
  ];

  const allRows = [...contentRows, ...taxonomyRows];
  return limit > 0 ? allRows.slice(0, limit) : allRows;
}

function taxonomyRow(term, type) {
  const urlPath = normalizePath(term.path || term.link);
  return {
    old_url: new URL(urlPath, LIVE_ORIGIN).toString(),
    path: urlPath,
    type,
    status_code: 200,
    title: term.seo?.title || term.name || '',
    h1: term.name || '',
    canonical: term.seo?.canonical || new URL(urlPath, LIVE_ORIGIN).toString(),
    meta_description: term.seo?.description || stripHtml(term.description || ''),
    word_count: stripHtml(term.description || '').split(/\s+/).filter(Boolean).length,
    internal_links_count: 0,
    notes: 'from_wordpress_export',
  };
}

async function auditUrl(oldUrl) {
  try {
    const { response, text } = await fetchText(oldUrl);
    const title = extractTag(text, 'title');
    const h1 = extractTag(text, 'h1');
    const canonical = extractCanonical(text);
    const metaDescription = extractMeta(text, 'description');
    const internalLinks = extractLinks(text, oldUrl).filter((url) => new URL(url).origin === LIVE_ORIGIN);
    return {
      old_url: oldUrl,
      path: normalizePath(oldUrl),
      type: inferType(oldUrl),
      status_code: response.status,
      title,
      h1,
      canonical,
      meta_description: metaDescription,
      word_count: stripHtml(text).split(/\s+/).filter(Boolean).length,
      internal_links_count: new Set(internalLinks).size,
      notes: '',
    };
  } catch (error) {
    return {
      old_url: oldUrl,
      path: normalizePath(oldUrl),
      type: inferType(oldUrl),
      status_code: 'ERROR',
      title: '',
      h1: '',
      canonical: '',
      meta_description: '',
      word_count: 0,
      internal_links_count: 0,
      notes: error.message,
    };
  }
}

function inferType(url) {
  const path = normalizePath(url);
  if (path.startsWith('/category/')) return 'category';
  if (path.startsWith('/tag/')) return 'tag';
  if (path.startsWith('/author/')) return 'author';
  if (path === '/') return 'home';
  return 'content';
}
