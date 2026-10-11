#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { preflightAll } from './lib/preflight.js';
import { validateOrExit } from './lib/validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const videos = JSON.parse(fs.readFileSync(path.join(__dirname, 'videos.json'), 'utf-8'));

console.log('=== NEXORA Preflight — Asset Auto Processing ===');
validateOrExit(videos);
const results = preflightAll(videos);
console.log('\n=== Summary ===');
for (const r of results) {
  console.log(`  ${r.asset} [${r.type}] → ${r.status} ${r.error || ''}`);
}
const failed = results.filter(r => r.status === 'FAILED' || r.status === 'MISSING');
if (failed.length) {
  console.error(`\n❌ ${failed.length} assets failed`);
  process.exit(1);
} else {
  console.log('\n✅ All assets READY (original or processed)');
}
