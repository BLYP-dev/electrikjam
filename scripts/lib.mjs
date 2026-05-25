import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const LIVE_ORIGIN = 'https://www.electrikjam.com';
export const STAGING_ORIGIN = 'https://next.electrikjam.com';

export function normalizePath(input) {
  if (!input || input === '/') return '/';
  const rawPath = input.startsWith('http') ? new URL(input).pathname : input;
  return `/${rawPath.replace(/^\/+|\/+$/g, '')}/`;
}

export function stripHtml(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function decodeEntities(text = '') {
  return stripHtml(text)
    .replace(/&quot;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function slugify(input = 'item') {
  return decodeEntities(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'item';
}

export function csvEscape(value) {
  const string = value == null ? '' : String(value);
  return `"${string.replace(/"/g, '""')}"`;
}

export function toCsv(rows, columns) {
  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n') + '\n';
}

export async function writeTextFile(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

export async function readCsv(path) {
  const contents = await readFile(path, 'utf8');
  const lines = contents.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() || '');
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

export async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': 'ElectrikJam Astro migration audit',
      ...options.headers,
    },
    ...options,
  });
  const text = await response.text();
  return { response, text };
}

export async function fetchJson(url) {
  const { response, text } = await fetchText(url, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}: ${text.slice(0, 160)}`);
  }
  return JSON.parse(text);
}

export function extractTag(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return decodeEntities(match?.[1] || '');
}

export function extractMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${name}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]);
  }
  return '';
}

export function extractCanonical(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  return match?.[1] || '';
}

export function extractLinks(html, baseUrl) {
  return Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
    .map((match) => {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

export function extractImages(html, baseUrl) {
  return Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi))
    .map((match) => {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

export function extractJsonLd(html) {
  return Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export async function discoverSitemapUrls(origin = LIVE_ORIGIN) {
  const candidates = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml'];
  for (const path of candidates) {
    const url = new URL(path, origin).toString();
    const { response, text } = await fetchText(url);
    if (response.ok && text.includes('<urlset')) {
      return parseSitemapUrls(text);
    }
    if (response.ok && text.includes('<sitemapindex')) {
      return discoverFromSitemapIndex(text);
    }
  }
  return [origin + '/'];
}

async function discoverFromSitemapIndex(xml) {
  const childSitemaps = Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)).map((match) => match[1]);
  const urls = [];
  for (const sitemapUrl of childSitemaps) {
    const { response, text } = await fetchText(sitemapUrl);
    if (response.ok) urls.push(...parseSitemapUrls(text));
  }
  return [...new Set(urls)];
}

function parseSitemapUrls(xml) {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)).map((match) => match[1]);
}

export function projectPath(...parts) {
  return join(process.cwd(), ...parts);
}
