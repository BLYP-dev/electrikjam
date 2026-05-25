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

const limit = Number(process.env.AUDIT_LIMIT || 200);
const urls = (await discoverSitemapUrls(LIVE_ORIGIN)).slice(0, limit);
const rows = [];

for (const oldUrl of urls) {
  const row = await auditUrl(oldUrl);
  rows.push(row);
  console.log(`${row.status_code} ${row.path}`);
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
