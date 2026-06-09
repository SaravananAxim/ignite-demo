/**
 * Product-SKU join table import
 * Run: node scripts/import-product-skus.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dir, '..', '.env'), 'utf-8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
);

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_PUBLISHABLE_KEY']);

const records = JSON.parse(readFileSync(join(__dir, 'product_skus.json'), 'utf-8'));
console.log(`Importing ${records.length} product_skus joins...`);

const BATCH = 100;
let inserted = 0, errors = 0;

for (let i = 0; i < records.length; i += BATCH) {
  const batch = records.slice(i, i + BATCH);
  const { error } = await supabase
    .from('product_skus')
    .upsert(batch, { onConflict: 'product_id,sku_id', ignoreDuplicates: true });
  if (error) {
    console.error(`Batch ${Math.floor(i/BATCH)+1} failed:`, error.message);
    errors++;
  } else {
    inserted += batch.length;
    process.stdout.write(`\r${inserted}/${records.length} rows...`);
  }
}
console.log(`\nDone — ${inserted} inserted, ${errors} errors`);
