#!/usr/bin/env node
import {
  discoverSitemapUrls,
  extractCanonical,
  extractImages,
  extractJsonLd,
  extractLinks,
  extractMeta,
  extractTag,
  fetchText,
  LIVE_ORIGIN,
  normalizePath,
  projectPath,
  readCsv,
  STAGING_ORIGIN,
  toCsv,
  writeTextFile,
} from './lib.mjs';

const limit = Number(process.env.PARITY_LIMIT || 50);
const inventoryPath = projectPath('url-inventory.csv');
const paths = await getPaths();
const rows = [];

for (const path of paths.slice(0, limit)) {
  const row = await comparePath(path);
  rows.push(row);
  console.log(`${row.match === 'yes' ? 'OK' : 'DIFF'} ${path}`);
}

const columns = [
  'path',
  'live_url',
  'staging_url',
  'live_status',
  'staging_status',
  'title_match',
  'meta_description_match',
  'canonical_match',
  'h1_match',
  'robots_live',
  'robots_staging',
  'schema_match',
  'internal_links_match',
  'image_availability',
  'trailing_slash_match',
  'match',
  'notes',
];

await writeTextFile(projectPath('parity-report.csv'), toCsv(rows, columns));
console.log(`Wrote parity-report.csv with ${rows.length} rows.`);

async function getPaths() {
  try {
    const rows = await readCsv(inventoryPath);
    return rows.map((row) => row.path).filter(Boolean);
  } catch {
    const urls = await discoverSitemapUrls(LIVE_ORIGIN);
    return urls.map((url) => normalizePath(url));
  }
}

async function comparePath(path) {
  const normalizedPath = normalizePath(path);
  const liveUrl = new URL(normalizedPath, LIVE_ORIGIN).toString();
  const stagingUrl = new URL(normalizedPath, STAGING_ORIGIN).toString();
  const [live, staging] = await Promise.all([inspect(liveUrl), inspect(stagingUrl)]);
  const checks = {
    title_match: same(live.title, staging.title),
    meta_description_match: same(live.metaDescription, staging.metaDescription),
    canonical_match: same(live.canonical, staging.canonical),
    h1_match: same(live.h1, staging.h1),
    schema_match: same(live.schema.join('\n'), staging.schema.join('\n')),
    internal_links_match: live.internalLinksCount === staging.internalLinksCount ? 'yes' : 'no',
    trailing_slash_match: normalizedPath.endsWith('/') && staging.finalUrl.endsWith('/') ? 'yes' : 'no',
  };
  const imageAvailability = await checkImages(staging.images.slice(0, 10));
  const match = [
    live.status === staging.status ? 'yes' : 'no',
    ...Object.values(checks),
    imageAvailability,
  ].every((value) => value === 'yes') ? 'yes' : 'no';

  return {
    path: normalizedPath,
    live_url: liveUrl,
    staging_url: stagingUrl,
    live_status: live.status,
    staging_status: staging.status,
    ...checks,
    robots_live: live.robots,
    robots_staging: staging.robots,
    image_availability: imageAvailability,
    match,
    notes: collectNotes(live, staging),
  };
}

async function inspect(url) {
  try {
    const { response, text } = await fetchText(url);
    const origin = new URL(url).origin;
    const internalLinks = extractLinks(text, url).filter((link) => new URL(link).origin === origin);
    return {
      status: response.status,
      finalUrl: response.url,
      title: extractTag(text, 'title'),
      metaDescription: extractMeta(text, 'description'),
      canonical: extractCanonical(text),
      h1: extractTag(text, 'h1'),
      robots: [extractMeta(text, 'robots'), response.headers.get('x-robots-tag') || ''].filter(Boolean).join('; '),
      schema: extractJsonLd(text),
      internalLinksCount: new Set(internalLinks).size,
      images: extractImages(text, url),
      error: '',
    };
  } catch (error) {
    return {
      status: 'ERROR',
      finalUrl: url,
      title: '',
      metaDescription: '',
      canonical: '',
      h1: '',
      robots: '',
      schema: [],
      internalLinksCount: 0,
      images: [],
      error: error.message,
    };
  }
}

async function checkImages(images) {
  for (const image of images) {
    try {
      const response = await fetch(image, { method: 'HEAD', redirect: 'follow' });
      if (!response.ok) return 'no';
    } catch {
      return 'no';
    }
  }
  return 'yes';
}

function same(left, right) {
  return normalizeValue(left) === normalizeValue(right) ? 'yes' : 'no';
}

function normalizeValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function collectNotes(live, staging) {
  return [live.error, staging.error].filter(Boolean).join(' | ');
}
