import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_INPUT = '.cache/product-feed/guitar-center-electric-guitars-first-batch.json';
const TABLE = 'affiliate_products';
const CHUNK_SIZE = Number(process.env.SUPABASE_IMPORT_CHUNK_SIZE || 250);

await loadLocalEnv('.env.products.local');
await loadLocalEnv('.env.local');
await loadLocalEnv('.env');

const inputPath = process.argv.find((arg) => !arg.startsWith('--') && arg !== process.argv[1] && arg !== process.argv[0])
  || process.env.PRODUCT_IMPORT_INPUT
  || DEFAULT_INPUT;
const dryRun = process.argv.includes('--dry-run');
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const products = JSON.parse(await readFile(join(process.cwd(), inputPath), 'utf8'));
const rows = products.map(toSupabaseRow);

console.log(`Prepared ${rows.length.toLocaleString()} products from ${inputPath}.`);

if (dryRun || !supabaseUrl || !serviceRoleKey) {
  console.log('Dry run only. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.products.local to upload.');
  console.table(summarize(rows));
  process.exit(0);
}

for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
  const chunk = rows.slice(index, index + CHUNK_SIZE);
  await upsertChunk(chunk);
  console.log(`Uploaded ${Math.min(index + CHUNK_SIZE, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
}

console.log(`Imported ${rows.length.toLocaleString()} products into Supabase table ${TABLE}.`);

function toSupabaseRow(product) {
  return {
    source: product.source,
    source_id: product.source_id,
    canonical_brand: product.canonical_brand,
    source_brand: product.source_brand,
    title: product.title,
    short_title: product.short_title || null,
    description: product.description || null,
    product_type: product.product_type || null,
    google_product_category: product.google_product_category || null,
    string_count: toInteger(product.string_count),
    is_baritone: Boolean(product.is_baritone),
    is_extended_range: Boolean(product.is_extended_range),
    is_left_handed: Boolean(product.is_left_handed),
    is_semi_hollow: Boolean(product.is_semi_hollow),
    is_travel_or_mini: Boolean(product.is_travel_or_mini),
    affiliate_url: product.affiliate_url || null,
    merchant_url: product.merchant_url || null,
    image_url: product.image_url || null,
    condition: product.condition || null,
    availability: product.availability || null,
    price: toNumber(product.price),
    sale_price: toNumber(product.sale_price),
    currency: 'USD',
    gtin: product.gtin || null,
    mpn: product.mpn || null,
    item_group_id: product.item_group_id || null,
    color: product.color || null,
    material: product.material || null,
    shipping_weight: product.shipping_weight || null,
    custom_label_0: product.custom_label_0 || null,
    custom_label_1: product.custom_label_1 || null,
    custom_label_2: product.custom_label_2 || null,
    custom_label_3: product.custom_label_3 || null,
    custom_label_4: product.custom_label_4 || null,
    promotion_id_1: product.promotion_id_1 || null,
    promotion_id_2: product.promotion_id_2 || null,
    raw_feed: product,
    last_seen_at: new Date().toISOString(),
  };
}

async function upsertChunk(chunk) {
  const url = new URL(`/rest/v1/${TABLE}`, supabaseUrl);
  url.searchParams.set('on_conflict', 'source,source_id');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(chunk),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase import failed ${response.status}: ${text.slice(0, 500)}`);
  }
}

function summarize(items) {
  const byBrand = {};
  const byCondition = {};
  for (const item of items) {
    byBrand[item.canonical_brand] = (byBrand[item.canonical_brand] || 0) + 1;
    byCondition[item.condition] = (byCondition[item.condition] || 0) + 1;
  }
  return {
    total: items.length,
    new: byCondition.New || 0,
    used: byCondition.Used || 0,
    brands: Object.entries(byBrand).length,
  };
}

function toNumber(value) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value) {
  if (value === '' || value == null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function loadLocalEnv(relativePath) {
  try {
    const text = await readFile(join(process.cwd(), relativePath), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // Local env files are optional.
  }
}
