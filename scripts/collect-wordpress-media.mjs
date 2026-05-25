#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizePath, projectPath } from './lib.mjs';

const contentRoot = projectPath('src', 'content');
const outputFile = process.argv[2] || projectPath('.wordpress-media-files.txt');
const mediaPaths = new Set();

await walk(contentRoot);

const files = [...mediaPaths].sort();
await writeFile(outputFile, files.join('\n') + (files.length ? '\n' : ''));
console.log(`Found ${files.length} referenced WordPress media files.`);
console.log(`Wrote ${outputFile}`);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      await collectFromFile(path);
    }
  }
}

async function collectFromFile(path) {
  const contents = await readFile(path, 'utf8');
  const patterns = [
    /https?:\/\/(?:www\.electrikjam\.com|staging-electrikjam\.kinsta\.cloud)(\/wp-content\/uploads\/[^"'\s,)&]+)/gi,
    /(?:^|["'(\s])((?:\/wp-content\/uploads\/)[^"'\s,)&]+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of contents.matchAll(pattern)) {
      const mediaPath = match[2] || match[1];
      if (!mediaPath) continue;
      mediaPaths.add(decodeURIComponent(normalizePath(mediaPath).replace(/\/$/, '')));
    }
  }
}
