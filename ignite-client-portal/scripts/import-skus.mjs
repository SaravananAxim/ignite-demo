/**
 * SKU Import Script
 * Run from the project root: node scripts/import-skus.mjs
 * Requires: .env with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load env manually (no dotenv needed — we read the file directly)
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
);

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Load the cleaned SKU data
const dataPath = join(__dir, '..', '..', 'AI-Automated Client Onboarding', 'demo', 'skus_data.json');
let records;
try {
  records = JSON.parse(readFileSync(dataPath, 'utf-8'));
} catch {
  // Fallback: look in same directory as script
  const localPath = join(__dir, 'skus_data.json');
  records = JSON.parse(readFileSync(localPath, 'utf-8'));
}

console.log(`Importing ${records.length} SKUs...`);

const BATCH = 100;
let inserted = 0;
let errors = 0;

for (let i = 0; i < records.length; i += BATCH) {
  const batch = records.slice(i, i + BATCH);
  const { error } = await supabase
    .from('skus')
    .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });

  if (error) {
    console.error(`Batch ${Math.floor(i/BATCH)+1} failed:`, error.message);
    errors++;
  } else {
    inserted += batch.length;
    process.stdout.write(`\r${inserted}/${records.length} rows inserted...`);
  }
}

console.log(`\n\nDone — ${inserted} inserted, ${errors} batch errors`);
