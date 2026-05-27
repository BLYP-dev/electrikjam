#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { projectPath } from './lib.mjs';

const run = promisify(execFile);
const exportUrl = process.env.WP_EXPORT_URL;
const exportToken = process.env.WP_EXPORT_TOKEN;
const exportFile = process.env.WP_EXPORT_FILE;

if (!exportUrl && !exportFile) {
  console.log('No WordPress sync source configured; using committed content snapshot.');
  process.exit(0);
}

const file = exportFile || projectPath('.cache', 'wordpress-export.json');

if (exportUrl) {
  const response = await fetch(exportUrl, {
    headers: {
      accept: 'application/json',
      ...(exportToken ? { authorization: `Bearer ${exportToken}` } : {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`WordPress export failed ${response.status}: ${text.slice(0, 240)}`);
  }

  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text);
  console.log(`Fetched WordPress export from ${exportUrl}.`);
}

await run('node', ['scripts/import-wordpress.mjs'], {
  env: {
    ...process.env,
    WP_EXPORT_FILE: file,
    WP_IMPORT_LIMIT: process.env.WP_IMPORT_LIMIT || '-1',
    WP_PAGE_IMPORT_LIMIT: process.env.WP_PAGE_IMPORT_LIMIT || '-1',
    WP_MEDIA_MODE: process.env.WP_MEDIA_MODE || 'local',
  },
  maxBuffer: 20 * 1024 * 1024,
});

console.log('Synced Astro content from WordPress.');
