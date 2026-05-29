import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { csvEscape } from './lib.mjs';

const DEFAULT_INPUT = '/Users/richardgoodwin/Desktop/guitar-center-product-feed.txt';
const DEFAULT_OUTPUT_DIR = '.cache/product-feed';

const inputPath = process.env.GC_FEED_INPUT || process.argv[2] || DEFAULT_INPUT;
const outputDir = process.env.GC_FEED_OUTPUT_DIR || process.argv[3] || DEFAULT_OUTPUT_DIR;
const outputBase = process.env.GC_FEED_OUTPUT_BASE || 'guitar-center-electric-guitars-first-batch';

const TARGET_BRANDS = [
  {
    canonical: 'Ibanez',
    matches: [/^ibanez\b/i, /^soundgear by ibanez$/i, /^salvador ibanez$/i],
  },
  {
    canonical: 'ESP / LTD',
    matches: [/^esp\b/i, /^esp ltd$/i, /^ltd$/i, /^ltd by esp$/i, /^ltd deluxe$/i, /^esp custom shop$/i, /^est ltd$/i],
  },
  {
    canonical: 'Jackson',
    matches: [/^jackson\b/i, /^grover jackson$/i, /^jackson gouldan chris$/i],
  },
  {
    canonical: 'Schecter',
    matches: [/^schecter\b/i, /^schecter guitar research$/i, /^schecter diamond series$/i],
  },
  {
    canonical: 'Gibson',
    matches: [/^gibson\b/i, /^gibsons$/i, /^gibson custom/i, /^orville by gibson$/i],
  },
  {
    canonical: 'Fender',
    matches: [/^fender\b/i, /^fender custom shop$/i, /^fender player/i, /^fender`$/i, /^fender -$/i],
  },
  {
    canonical: 'PRS',
    matches: [/^prs$/i, /^prs\b/i, /^prs se$/i, /^prs ce3b$/i],
  },
  {
    canonical: 'Strandberg',
    matches: [/^strandberg$/i],
  },
  {
    canonical: 'Charvel',
    matches: [/^charvel\b/i, /^wayne charvel$/i, /^charvette by charvel$/i, /^charvel by jackson$/i],
  },
  {
    canonical: 'EVH',
    matches: [/^evh$/i],
  },
  {
    canonical: 'Solar Guitars',
    matches: [/^solar guitars$/i],
  },
];

const PRODUCT_COLUMNS = [
  'source',
  'source_id',
  'canonical_brand',
  'source_brand',
  'title',
  'short_title',
  'description',
  'product_type',
  'google_product_category',
  'string_count',
  'is_baritone',
  'is_extended_range',
  'is_left_handed',
  'is_semi_hollow',
  'is_travel_or_mini',
  'affiliate_url',
  'merchant_url',
  'image_url',
  'condition',
  'availability',
  'price',
  'sale_price',
  'gtin',
  'mpn',
  'item_group_id',
  'color',
  'material',
  'shipping_weight',
  'custom_label_0',
  'custom_label_1',
  'custom_label_2',
  'custom_label_3',
  'custom_label_4',
  'promotion_id_1',
  'promotion_id_2',
];

const rows = [];
const summary = {
  input: inputPath,
  generatedAt: new Date().toISOString(),
  totalRowsRead: 0,
  matchedRows: 0,
  skippedRows: 0,
  byBrand: Object.fromEntries(TARGET_BRANDS.map(({ canonical }) => [canonical, 0])),
  byCondition: {},
  byProductType: {},
  output: {},
};

const reader = createInterface({
  input: createReadStream(inputPath),
  crlfDelay: Infinity,
});

let headers = [];

for await (const line of reader) {
  if (!line.trim()) continue;

  if (!headers.length) {
    headers = uniqueHeaders(line.split('\t'));
    continue;
  }

  summary.totalRowsRead += 1;
  const record = toRecord(headers, line.split('\t'));
  const canonicalBrand = getCanonicalBrand(record.brand || '');

  if (!canonicalBrand || !isGuitarProduct(record)) {
    summary.skippedRows += 1;
    continue;
  }

  const normalized = normalizeProduct(record, canonicalBrand);
  rows.push(normalized);
  summary.matchedRows += 1;
  summary.byBrand[canonicalBrand] += 1;
  summary.byCondition[normalized.condition] = (summary.byCondition[normalized.condition] || 0) + 1;
  summary.byProductType[normalized.product_type] = (summary.byProductType[normalized.product_type] || 0) + 1;
}

rows.sort((a, b) => (
  a.canonical_brand.localeCompare(b.canonical_brand)
  || a.product_type.localeCompare(b.product_type)
  || a.title.localeCompare(b.title)
));

const absoluteOutputDir = join(process.cwd(), outputDir);
await mkdir(absoluteOutputDir, { recursive: true });

const jsonPath = join(absoluteOutputDir, `${outputBase}.json`);
const csvPath = join(absoluteOutputDir, `${outputBase}.csv`);
const summaryPath = join(absoluteOutputDir, `${outputBase}-summary.json`);

summary.output = {
  directory: absoluteOutputDir,
  json: jsonPath,
  csv: csvPath,
  summary: summaryPath,
};

await writeFile(jsonPath, JSON.stringify(rows, null, 2));
await writeFile(csvPath, toCsv(rows, PRODUCT_COLUMNS));
await writeFile(summaryPath, JSON.stringify(summary, null, 2));

console.log(`Filtered ${summary.matchedRows.toLocaleString()} electric guitar products from ${basename(inputPath)}.`);
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${csvPath}`);
console.log(`Wrote ${summaryPath}`);
console.table(summary.byBrand);

function uniqueHeaders(rawHeaders) {
  const seen = new Map();
  return rawHeaders.map((header) => {
    const clean = header.trim();
    const count = seen.get(clean) || 0;
    seen.set(clean, count + 1);
    return count === 0 ? clean : `${clean}_${count}`;
  });
}

function toRecord(headerList, values) {
  return Object.fromEntries(headerList.map((header, index) => [header, values[index] || '']));
}

function getCanonicalBrand(sourceBrand) {
  const normalized = sourceBrand.trim();
  return TARGET_BRANDS.find(({ matches }) => matches.some((pattern) => pattern.test(normalized)))?.canonical || '';
}

function isGuitarProduct(record) {
  const productType = record.product_type || '';
  const googleCategory = record.google_product_category || '';
  const title = record.title || '';
  const searchable = `${productType} ${googleCategory}`;

  if (/bass/i.test(searchable)) return false;
  if (/\bbass\b/i.test(title)) return false;
  if (/acoustic|classical|nylon/i.test(searchable)) return false;
  if (/accessor|strap|case|string|pickup|part|lock|tuner/i.test(productType)) return false;

  return /^Guitars\s*>\s*Electric Guitars\s*>/i.test(productType);
}

function normalizeProduct(record, canonicalBrand) {
  const title = cleanText(record.title);
  const productType = cleanText(record.product_type);
  const combined = `${title} ${productType}`;

  return {
    source: 'guitar_center_awin',
    source_id: record.id,
    canonical_brand: canonicalBrand,
    source_brand: record.brand,
    title,
    short_title: cleanText(record.short_title),
    description: cleanText(record.description),
    product_type: productType,
    google_product_category: cleanText(record.google_product_category),
    string_count: detectStringCount(combined),
    is_baritone: /baritone/i.test(combined),
    is_extended_range: /extended range|7[- ]?string|8[- ]?string|9[- ]?string|\b7 string\b|\b8 string\b|\b9 string\b/i.test(combined),
    is_left_handed: /left[- ]handed|\blefty\b/i.test(combined),
    is_semi_hollow: /semi[- ]hollow|hollow body/i.test(combined),
    is_travel_or_mini: /travel|mini/i.test(productType),
    affiliate_url: record.link,
    merchant_url: extractMerchantUrl(record.link),
    image_url: record.image_link,
    condition: record.condition,
    availability: record.availability,
    price: normalizePrice(record.price),
    sale_price: normalizePrice(record.sale_price),
    gtin: record.gtin,
    mpn: record.mpn,
    item_group_id: record.item_group_id,
    color: cleanText(record.color),
    material: cleanText(record.material),
    shipping_weight: record.shipping_weight,
    custom_label_0: cleanText(record.custom_label_0),
    custom_label_1: cleanText(record.custom_label_1),
    custom_label_2: cleanText(record.custom_label_2),
    custom_label_3: cleanText(record.custom_label_3),
    custom_label_4: cleanText(record.custom_label_4),
    promotion_id_1: record.promotion_id,
    promotion_id_2: record.promotion_id_1,
  };
}

function extractMerchantUrl(affiliateUrl = '') {
  try {
    const url = new URL(affiliateUrl);
    return url.searchParams.get('u') || '';
  } catch {
    return '';
  }
}

function normalizePrice(price = '') {
  return price.replace(/[^0-9.]/g, '');
}

function detectStringCount(text = '') {
  const explicit = text.match(/\b([6-9])[- ]?string\b/i);
  if (explicit) return explicit[1];
  if (/extended range/i.test(text)) return '';
  return '6';
}

function cleanText(text = '') {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+\|\s+.*$/g, '')
    .trim();
}

function toCsv(items, columns) {
  return [
    columns.join(','),
    ...items.map((item) => columns.map((column) => csvEscape(item[column])).join(',')),
  ].join('\n') + '\n';
}
