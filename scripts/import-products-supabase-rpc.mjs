import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const inputPath = process.env.PRODUCT_IMPORT_INPUT || '.cache/product-feed/guitar-center-electric-guitars-first-batch.json';
const chunkSize = Number(process.env.SUPABASE_IMPORT_CHUNK_SIZE || 250);
const supabaseUrl = requiredEnv('SUPABASE_URL');
const publishableKey = requiredEnv('SUPABASE_PUBLISHABLE_KEY');
const importToken = requiredEnv('SUPABASE_IMPORT_TOKEN');

const products = JSON.parse(await readFile(join(process.cwd(), inputPath), 'utf8'));
const rows = products.map((product) => ({
  ...product,
  string_count: product.string_count === '' ? null : Number(product.string_count),
  price: product.price === '' ? null : Number(product.price),
  sale_price: product.sale_price === '' ? null : Number(product.sale_price),
  currency: 'USD',
  raw_feed: product,
}));

let uploaded = 0;

for (let index = 0; index < rows.length; index += chunkSize) {
  const chunk = rows.slice(index, index + chunkSize);
  await uploadChunk(chunk);
  uploaded += chunk.length;
  console.log(`Uploaded ${uploaded.toLocaleString()} / ${rows.length.toLocaleString()}`);
}

console.log(`Imported ${rows.length.toLocaleString()} products through temporary Supabase RPC.`);

async function uploadChunk(chunk) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/import_affiliate_products_temp`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${publishableKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      p_token: importToken,
      p_products: chunk,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase RPC import failed ${response.status}: ${text.slice(0, 1000)}`);
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
