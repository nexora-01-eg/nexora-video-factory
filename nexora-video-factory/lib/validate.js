import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACTORY_DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(FACTORY_DIR, '..');

export function validateVideos(videos) {
  const errors = [];
  const seenId = new Set();
  const seenSlug = new Set();

  // Load treasury to validate assets exist
  let treasury = null;
  try {
    treasury = JSON.parse(fs.readFileSync(path.join(ROOT, 'nexora-treasury', 'index.json'), 'utf-8'));
  } catch {}

  const validBgVideos = new Set((treasury?.assets?.videos?.backgrounds || []).map(v => v.file.split('/').pop()));
  // also allow processed check
  const validBgms = new Set([
    ...(treasury?.assets?.music?.background || []).map(m => m.file.split('/').pop()),
    ...(treasury?.assets?.music?.cinematic || []).map(m => m.file.split('/').pop())
  ]);

  for (const v of videos) {
    const prefix = `Video ${v.id || v.slug || 'unknown'}`;

    // Required fields
    const required = ['id', 'slug', 'title', 'hook', 'hookSub', 'problemTitle', 'points', 'stats', 'cta', 'ctaBtn', 'bgVideo', 'bgm'];
    for (const f of required) {
      if (v[f] === undefined || v[f] === null || (typeof v[f] === 'string' && v[f].trim() === '') || (Array.isArray(v[f]) && v[f].length === 0)) {
        errors.push({ videoId: v.id || v.slug, field: f, problem: `missing or empty` });
      }
    }

    // ID uniqueness
    if (v.id) {
      if (seenId.has(v.id)) errors.push({ videoId: v.id, field: 'id', problem: 'duplicate id' });
      seenId.add(v.id);
    }
    if (v.slug) {
      if (seenSlug.has(v.slug)) errors.push({ videoId: v.id, field: 'slug', problem: 'duplicate slug' });
      seenSlug.add(v.slug);
    }

    // points & stats must be arrays with reasonable length
    if (v.points && !Array.isArray(v.points)) errors.push({ videoId: v.id, field: 'points', problem: 'must be array' });
    if (v.stats && !Array.isArray(v.stats)) errors.push({ videoId: v.id, field: 'stats', problem: 'must be array' });
    if (v.points && v.points.length > 6) errors.push({ videoId: v.id, field: 'points', problem: 'too many points (max 6)' });
    if (v.stats && v.stats.length !== 3) errors.push({ videoId: v.id, field: 'stats', problem: 'stats must have exactly 3 items' });
    if (v.stats) {
      for (let i = 0; i < v.stats.length; i++) {
        if (!v.stats[i].num || !v.stats[i].label) errors.push({ videoId: v.id, field: `stats[${i}]`, problem: 'missing num or label' });
      }
    }

    // Asset existence
    if (v.bgVideo && !validBgVideos.has(v.bgVideo)) {
      // also check if file exists in treasury folder directly
      const p = path.join(ROOT, 'nexora-treasury', 'videos', 'backgrounds', v.bgVideo);
      if (!fs.existsSync(p)) errors.push({ videoId: v.id, field: 'bgVideo', problem: `file not found in treasury: ${v.bgVideo}` });
    }
    if (v.bgm && !validBgms.has(v.bgm)) {
      const p1 = path.join(ROOT, 'nexora-treasury', 'music', 'background', v.bgm);
      const p2 = path.join(ROOT, 'nexora-treasury', 'music', 'cinematic', v.bgm);
      if (!fs.existsSync(p1) && !fs.existsSync(p2)) errors.push({ videoId: v.id, field: 'bgm', problem: `file not found in treasury: ${v.bgm}` });
    }

    // duration validation
    if (v.duration !== undefined && (typeof v.duration !== 'number' || v.duration < 5 || v.duration > 120)) {
      errors.push({ videoId: v.id, field: 'duration', problem: 'must be number 5-120' });
    }
  }

  return errors;
}

export function validateOrExit(videos) {
  const errors = validateVideos(videos);
  if (errors.length > 0) {
    console.error('\n❌ videos.json validation failed:');
    for (const e of errors) {
      console.error(`  [${e.videoId}] field="${e.field}" → ${e.problem}`);
    }
    console.error(`\nTotal errors: ${errors.length}. Fix videos.json before generation.\n`);
    process.exit(1);
  }
  console.log(`✅ videos.json validation passed (${videos.length} videos)`);
  return true;
}
