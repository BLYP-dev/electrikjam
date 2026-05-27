#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  extractCanonical,
  extractImages,
  extractLinks,
  extractMeta,
  extractTag,
  LIVE_ORIGIN,
  normalizePath,
  projectPath,
  readCsv,
  STAGING_ORIGIN,
  toCsv,
  writeTextFile,
} from './lib.mjs';

const run = promisify(execFile);
const limit = Number(process.env.STAGING_COVERAGE_LIMIT || 0);
const concurrency = Number(process.env.STAGING_COVERAGE_CONCURRENCY || 8);
const imageLimit = Number(process.env.STAGING_IMAGE_LIMIT || 5);
const stagingOrigin = process.env.STAGING_ORIGIN || STAGING_ORIGIN;
const liveOrigin = process.env.LIVE_ORIGIN || LIVE_ORIGIN;

const inventory = await readCsv(projectPath('url-inventory.csv'));
const paths = inventory.map((row) => normalizePath(row.path)).filter(Boolean);
const selectedPaths = limit > 0 ? paths.slice(0, limit) : paths;
const rows = [];

let completed = 0;
await mapConcurrent(selectedPaths, concurrency, async (path) => {
  const row = await inspectPath(path);
  rows.push(row);
  completed += 1;
  if (completed % 25 === 0 || completed === selectedPaths.length) {
    console.log(`${completed}/${selectedPaths.length} checked`);
  }
});

rows.sort((left, right) => left.path.localeCompare(right.path));

const columns = [
  'path',
  'staging_url',
  'status',
  'final_url',
  'title',
  'h1',
  'canonical',
  'expected_canonical',
  'canonical_match',
  'robots',
  'noindex_header',
  'trailing_slash',
  'staging_host_links',
  'image_availability',
  'images_checked',
  'pass',
  'notes',
];

await writeTextFile(projectPath('staging-coverage-report.csv'), toCsv(rows, columns));
console.log('Wrote staging-coverage-report.csv');

async function inspectPath(path) {
  const stagingUrl = new URL(path, stagingOrigin).toString();
  const expectedCanonical = new URL(path, liveOrigin).toString();

  try {
    const { response, text } = await curlText(stagingUrl);
    const canonical = extractCanonical(text);
    const robotsHeader = response.headers.get('x-robots-tag') || '';
    const robotsMeta = extractMeta(text, 'robots');
    const images = extractImages(text, stagingUrl).slice(0, imageLimit);
    const imageAvailability = await checkImages(images);
    const links = extractLinks(text, stagingUrl);
    const stagingHostLinks = links.filter((link) => new URL(link).origin === stagingOrigin).length;
    const trailingSlash = new URL(response.url).pathname.endsWith('/') ? 'yes' : 'no';
    const noindexHeader = /noindex/i.test(robotsHeader) ? 'yes' : 'no';
    const canonicalMatch = canonical === expectedCanonical ? 'yes' : 'no';
    const statusPass = response.status === 200 ? 'yes' : 'no';

    const pass = [
      statusPass,
      canonicalMatch,
      noindexHeader,
      trailingSlash,
      imageAvailability,
    ].every((value) => value === 'yes') ? 'yes' : 'no';

    return {
      path,
      staging_url: stagingUrl,
      status: response.status,
      final_url: response.url,
      title: extractTag(text, 'title'),
      h1: extractTag(text, 'h1'),
      canonical,
      expected_canonical: expectedCanonical,
      canonical_match: canonicalMatch,
      robots: [robotsMeta, robotsHeader].filter(Boolean).join('; '),
      noindex_header: noindexHeader,
      trailing_slash: trailingSlash,
      staging_host_links: stagingHostLinks,
      image_availability: imageAvailability,
      images_checked: images.length,
      pass,
      notes: '',
    };
  } catch (error) {
    return {
      path,
      staging_url: stagingUrl,
      status: 'ERROR',
      final_url: stagingUrl,
      title: '',
      h1: '',
      canonical: '',
      expected_canonical: expectedCanonical,
      canonical_match: 'no',
      robots: '',
      noindex_header: 'no',
      trailing_slash: 'no',
      staging_host_links: 0,
      image_availability: 'no',
      images_checked: 0,
      pass: 'no',
      notes: error.message,
    };
  }
}

async function checkImages(images) {
  for (const image of images) {
    try {
      const { response } = await curlText(image, { head: true });
      if (response.status < 200 || response.status >= 400) return 'no';
    } catch {
      return 'no';
    }
  }
  return 'yes';
}

async function curlText(url, options = {}) {
  const tempDir = await mkdtemp(join(tmpdir(), 'electrikjam-staging-'));
  const headerPath = join(tempDir, 'headers.txt');
  try {
    const args = [
      '-L',
      '-sS',
      '--max-time',
      '30',
      '-A',
      'ElectrikJam Astro migration audit',
      '-D',
      headerPath,
      '-w',
      '\n__CURL_EFFECTIVE_URL__%{url_effective}',
    ];
    if (options.head) args.push('-I');
    args.push(url);

    const { stdout } = await run('curl', args, { maxBuffer: 20 * 1024 * 1024 });
    const headers = await readFile(headerPath, 'utf8');
    const headerBlocks = headers.trim().split(/\r?\n\r?\n/).filter(Boolean);
    const lastHeaders = headerBlocks.at(-1) || '';
    const status = Number(lastHeaders.match(/^HTTP\/\S+\s+(\d+)/i)?.[1] || 0);
    const finalUrlMarker = '\n__CURL_EFFECTIVE_URL__';
    const markerIndex = stdout.lastIndexOf(finalUrlMarker);
    const text = markerIndex >= 0 ? stdout.slice(0, markerIndex) : stdout;
    const finalUrl = markerIndex >= 0 ? stdout.slice(markerIndex + finalUrlMarker.length).trim() : url;

    return {
      response: {
        status,
        url: finalUrl,
        headers: {
          get(name) {
            const pattern = new RegExp(`^${escapeRegExp(name)}:\\s*(.+)$`, 'im');
            return lastHeaders.match(pattern)?.[1]?.trim() || '';
          },
        },
      },
      text,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function mapConcurrent(items, size, callback) {
  const queue = [...items];
  const workers = Array.from({ length: size }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      await callback(item);
    }
  });
  await Promise.all(workers);
}
