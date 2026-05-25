import type { CollectionEntry } from 'astro:content';

export const SITE_URL = 'https://www.electrikjam.com';
export const SITE_NAME = 'ELECTRIKJAM';
export const SITE_DESCRIPTION = 'The best guitar gear and how to use it.';

export type SiteEntry = CollectionEntry<'posts'> | CollectionEntry<'pages'>;

export function normalizePath(path: string): string {
  if (!path || path === '/') return '/';
  const withoutOrigin = path.replace(/^https?:\/\/[^/]+/i, '');
  const withoutQuery = withoutOrigin.split(/[?#]/)[0] ?? '/';
  return `/${withoutQuery.replace(/^\/+|\/+$/g, '')}/`;
}

export function canonicalUrl(path: string): string {
  return new URL(normalizePath(path), SITE_URL).toString();
}

export function archivePath(type: 'category' | 'tag' | 'author', slug: string): string {
  return normalizePath(`/${type}/${slug}/`);
}

export function sortByDateDesc<T extends SiteEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function stripHtml(html = ''): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerptText(entry: SiteEntry): string {
  return stripHtml(entry.data.seo?.description || entry.data.excerpt || '').slice(0, 180);
}
