#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const videos = JSON.parse(fs.readFileSync(path.join(__dirname, 'videos.json'), 'utf-8'));

const mode = process.argv[2] || 'check'; // check | render | both

for (const v of videos) {
  const dir = path.join(ROOT, 'videos', v.slug);
  console.log(`\n========== ${v.slug} [${mode}] ==========`);
  try {
    if (mode === 'check' || mode === 'both') {
      console.log(`> checking ${v.slug} ...`);
      execSync(`npx --yes hyperframes@0.8.30 check`, { cwd: dir, stdio: 'inherit' });
    }
    if (mode === 'render' || mode === 'both') {
      console.log(`> rendering ${v.slug} ...`);
      // ensure renders dir
      fs.mkdirSync(path.join(dir, 'renders'), { recursive: true });
      execSync(`npx --yes hyperframes@0.8.30 render --output renders/output.mp4`, { cwd: dir, stdio: 'inherit' });
      const out = path.join(dir, 'renders', 'output.mp4');
      if (fs.existsSync(out)) {
        const s = fs.statSync(out);
        console.log(`✅ Rendered ${v.slug}: ${(s.size/1024/1024).toFixed(2)} MB`);
      }
    }
  } catch (e) {
    console.error(`❌ Failed ${v.slug}:`, e.message);
  }
}
console.log('\nDone.');
