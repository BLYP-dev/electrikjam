import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const inputPath = process.env.PRODUCT_IMPORT_INPUT || '.cache/product-feed/guitar-center-electric-guitars-first-batch.json';
const outputDir = process.env.PRODUCT_IMPORT_SQL_DIR || '.cache/product-feed/sql';
const chunkSize = Number(process.env.PRODUCT_IMPORT_SQL_CHUNK_SIZE || 500);

const products = JSON.parse(await readFile(join(process.cwd(), inputPath), 'utf8'));
const rows = products.map(toSqlRow);
const absoluteOutputDir = join(process.cwd(), outputDir);

await mkdir(absoluteOutputDir, { recursive: true });

const files = [];
for (let index = 0; index < rows.length; index += chunkSize) {
  const chunk = rows.slice(index, index + chunkSize);
  const chunkNumber = String(files.length + 1).padStart(4, '0');
  const filePath = join(absoluteOutputDir, `affiliate-products-${chunkNumber}.sql`);
  await writeFile(filePath, buildSql(chunk));
  files.push(filePath);
}

const manifest = {
  input: inputPath,
  outputDir: absoluteOutputDir,
  chunkSize,
  totalRows: rows.length,
  files,
};

await writeFile(join(absoluteOutputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Built ${files.length} SQL chunks for ${rows.length.toLocaleString()} products.`);
console.log(`Wrote ${join(absoluteOutputDir, 'manifest.json')}`);

function toSqlRow(product) {
  return {
    source: product.source,
    source_id: product.source_id,
    canonical_brand: product.canonical_brand,
    source_brand: product.source_brand || null,
    title: product.title,
    short_title: product.short_title || null,
    description: product.description || null,
    product_type: product.product_type || null,
    google_product_category: product.google_product_category || null,
    string_count: product.string_count === '' ? null : Number(product.string_count),
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
  };
}

function buildSql(chunk) {
  const payload = JSON.stringify(chunk).replace(/'/g, "''");
  return `with incoming as (
  select *
  from jsonb_to_recordset('${payload}'::jsonb) as x(
    source text,
    source_id text,
    canonical_brand text,
    source_brand text,
    title text,
    short_title text,
    description text,
    product_type text,
    google_product_category text,
    string_count smallint,
    is_baritone boolean,
    is_extended_range boolean,
    is_left_handed boolean,
    is_semi_hollow boolean,
    is_travel_or_mini boolean,
    affiliate_url text,
    merchant_url text,
    image_url text,
    condition text,
    availability text,
    price numeric,
    sale_price numeric,
    currency text,
    gtin text,
    mpn text,
    item_group_id text,
    color text,
    material text,
    shipping_weight text,
    custom_label_0 text,
    custom_label_1 text,
    custom_label_2 text,
    custom_label_3 text,
    custom_label_4 text,
    promotion_id_1 text,
    promotion_id_2 text,
    raw_feed jsonb
  )
)
insert into public.affiliate_products (
  source,
  source_id,
  canonical_brand,
  source_brand,
  title,
  short_title,
  description,
  product_type,
  google_product_category,
  string_count,
  is_baritone,
  is_extended_range,
  is_left_handed,
  is_semi_hollow,
  is_travel_or_mini,
  affiliate_url,
  merchant_url,
  image_url,
  condition,
  availability,
  price,
  sale_price,
  currency,
  gtin,
  mpn,
  item_group_id,
  color,
  material,
  shipping_weight,
  custom_label_0,
  custom_label_1,
  custom_label_2,
  custom_label_3,
  custom_label_4,
  promotion_id_1,
  promotion_id_2,
  raw_feed,
  last_seen_at
)
select
  source,
  source_id,
  canonical_brand,
  source_brand,
  title,
  short_title,
  description,
  product_type,
  google_product_category,
  string_count,
  is_baritone,
  is_extended_range,
  is_left_handed,
  is_semi_hollow,
  is_travel_or_mini,
  affiliate_url,
  merchant_url,
  image_url,
  condition,
  availability,
  price,
  sale_price,
  coalesce(currency, 'USD'),
  gtin,
  mpn,
  item_group_id,
  color,
  material,
  shipping_weight,
  custom_label_0,
  custom_label_1,
  custom_label_2,
  custom_label_3,
  custom_label_4,
  promotion_id_1,
  promotion_id_2,
  raw_feed,
  now()
from incoming
on conflict (source, source_id) do update set
  canonical_brand = excluded.canonical_brand,
  source_brand = excluded.source_brand,
  title = excluded.title,
  short_title = excluded.short_title,
  description = excluded.description,
  product_type = excluded.product_type,
  google_product_category = excluded.google_product_category,
  string_count = excluded.string_count,
  is_baritone = excluded.is_baritone,
  is_extended_range = excluded.is_extended_range,
  is_left_handed = excluded.is_left_handed,
  is_semi_hollow = excluded.is_semi_hollow,
  is_travel_or_mini = excluded.is_travel_or_mini,
  affiliate_url = excluded.affiliate_url,
  merchant_url = excluded.merchant_url,
  image_url = excluded.image_url,
  condition = excluded.condition,
  availability = excluded.availability,
  price = excluded.price,
  sale_price = excluded.sale_price,
  currency = excluded.currency,
  gtin = excluded.gtin,
  mpn = excluded.mpn,
  item_group_id = excluded.item_group_id,
  color = excluded.color,
  material = excluded.material,
  shipping_weight = excluded.shipping_weight,
  custom_label_0 = excluded.custom_label_0,
  custom_label_1 = excluded.custom_label_1,
  custom_label_2 = excluded.custom_label_2,
  custom_label_3 = excluded.custom_label_3,
  custom_label_4 = excluded.custom_label_4,
  promotion_id_1 = excluded.promotion_id_1,
  promotion_id_2 = excluded.promotion_id_2,
  raw_feed = excluded.raw_feed,
  last_seen_at = now();\n`;
}

function toNumber(value) {
  if (value === '' || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
