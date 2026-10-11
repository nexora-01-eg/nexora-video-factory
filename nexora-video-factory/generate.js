#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { validateOrExit } from './lib/validate.js';
import { preflightAll, resolveAssetPath } from './lib/preflight.js';
import { logPipeline } from './lib/logger.js';
import { qcVideo } from './lib/qc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VIDEOS_DIR = path.join(ROOT, 'videos');
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const SKIP_PREFLIGHT = args.includes('--skip-preflight');
const SKIP_QC = args.includes('--skip-qc');

const videos = JSON.parse(fs.readFileSync(path.join(__dirname, 'videos.json'), 'utf-8'));
const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf-8');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

function buildPointsHtml(points) {
  return points.map((p, i) => `<div class="pi" id="pi${i+1}">${p}</div>`).join('\n          ');
}
function buildStatsHtml(stats) {
  return stats.map((s, i) => `<div class="st" id="st${i+1}"><div class="sn">${s.num}</div><div class="sl">${s.label}</div></div>`).join('\n          ');
}
function buildPointsTimeline(points) {
  return points.map((_, i) => `tl.to("#pi${i+1}", { opacity: 1, x: 0, duration: 0.48, ease: "power2.out" }, ${11 + i*0.5});`).join('\n      ');
}
function buildStatsTimeline(stats) {
  return stats.map((_, i) => `tl.to("#st${i+1}", { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.4)" }, ${18.4 + i*0.4});`).join('\n      ');
}

function hashContent(str) {
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 8);
}

console.log(`\n=== NEXORA VIDEO FACTORY V2 — Generate ===`);
console.log(`Videos: ${videos.length} | Force: ${FORCE} | SkipPreflight: ${SKIP_PREFLIGHT}`);

// 1. Validate
validateOrExit(videos);

// 2. Preflight
if (!SKIP_PREFLIGHT) {
  console.log('\n[Preflight] Checking assets...');
  preflightAll(videos);
} else {
  console.log('\n[Preflight] Skipped (--skip-preflight)');
}

let generated = 0, skipped = 0, errors = 0;

for (const v of videos) {
  const slug = v.slug;
  const outDir = path.join(VIDEOS_DIR, slug);
  const duration = v.duration || CONFIG.expectedDuration;
  const manifestPath = path.join(outDir, 'manifest.json');
  const outputPath = path.join(outDir, 'renders', 'output.mp4');

  // Idempotency: skip if DONE and not force and files match hash
  let shouldSkip = false;
  if (!FORCE && fs.existsSync(outDir) && fs.existsSync(path.join(outDir, 'index.html')) && fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      // If manifest says DONE and QC passed and template hash matches, skip
      if (manifest.status === 'DONE' && manifest.qc?.ok && fs.existsSync(outputPath)) {
        const qc = qcVideo(outputPath, duration);
        if (qc.ok) {
          // also check if video data hash matches manifest
          const dataHash = hashContent(JSON.stringify(v));
          if (manifest.dataHash === dataHash) {
            console.log(`  ⏭️  ${slug} — SKIP (already DONE, QC ok, data unchanged)`);
            skipped++;
            shouldSkip = true;
          }
        }
      }
      // Also if index.html already exists and data unchanged, but no render yet, we can skip regeneration unless template changed
      if (!shouldSkip) {
        const dataHash = hashContent(JSON.stringify(v));
        const templateHash = hashContent(template);
        if (manifest.dataHash === dataHash && manifest.templateHash === templateHash && !FORCE) {
          console.log(`  ⏭️  ${slug} — SKIP (index.html up to date)`);
          skipped++;
          shouldSkip = true;
        }
      }
    } catch {}
  }

  if (shouldSkip) continue;

  console.log(`\n=== Generating ${slug}: ${v.title} ===`);

  // Ensure directories (do NOT delete renders if QC passed unless --force)
  const hadRenders = fs.existsSync(path.join(outDir, 'renders', 'output.mp4'));
  let preserveRenders = false;
  if (hadRenders && !FORCE) {
    const qc = qcVideo(outputPath, duration);
    if (qc.ok) {
      preserveRenders = true;
      console.log(`  ℹ️  Preserving existing render (QC passed, use --force to overwrite)`);
    }
  }

  // Clean but preserve renders if needed
  if (fs.existsSync(outDir)) {
    if (preserveRenders) {
      // Remove everything except renders folder
      for (const entry of fs.readdirSync(outDir)) {
        if (entry === 'renders') continue;
        fs.rmSync(path.join(outDir, entry), { recursive: true, force: true });
      }
    } else {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
  if (preserveRenders) {
    // renders already exists
  } else {
    fs.mkdirSync(path.join(outDir, 'renders'), { recursive: true });
  }

  // Build HTML
  let html = template
    .replaceAll('{{VIDEO_NUM}}', v.id)
    .replaceAll('{{HOOK}}', v.hook)
    .replaceAll('{{HOOK_SUB}}', v.hookSub)
    .replaceAll('{{PROBLEM_TITLE}}', v.problemTitle)
    .replaceAll('{{POINTS_HTML}}', buildPointsHtml(v.points))
    .replaceAll('{{STATS_HTML}}', buildStatsHtml(v.stats))
    .replaceAll('{{POINTS_TIMELINE}}', buildPointsTimeline(v.points))
    .replaceAll('{{STATS_TIMELINE}}', buildStatsTimeline(v.stats))
    .replaceAll('{{CTA}}', v.cta)
    .replaceAll('{{CTA_BTN}}', v.ctaBtn)
    .replaceAll('{{BG_VIDEO_SRC}}', 'assets/' + v.bgVideo)
    .replaceAll('{{BGM_SRC}}', 'assets/' + v.bgm);

  // Also replace duration if template uses it
  html = html.replaceAll('data-duration="34"', `data-duration="${duration}"`);

  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf-8');

  // hyperframes.json
  fs.writeFileSync(path.join(outDir, 'hyperframes.json'), JSON.stringify({
    "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
    "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
    "paths": { "blocks": "compositions", "components": "compositions/components", "assets": "assets" },
    "media": { "autoProxy": true },
    "authoringSkill": "motion-graphics"
  }, null, 2));

  // package.json
  fs.writeFileSync(path.join(outDir, 'package.json'), JSON.stringify({
    "name": slug,
    "private": true,
    "type": "module",
    "scripts": {
      "dev": "npx --yes hyperframes@0.8.30 preview",
      "check": "npx --yes hyperframes@0.8.30 check",
      "render": "npx --yes hyperframes@0.8.30 render --output renders/output.mp4"
    }
  }, null, 2));

  // meta.json
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({
    "id": slug,
    "name": v.title,
    "createdAt": new Date().toISOString(),
    "factory": true,
    "version": "2.0",
    "videoNumber": v.id
  }, null, 2));

  // Copy assets — use processed if available
  const { videoSrc, audioSrc } = resolveAssetPath(v.bgVideo, v.bgm);
  const bgDest = path.join(outDir, 'assets', v.bgVideo);
  const bgmDest = path.join(outDir, 'assets', v.bgm);

  try {
    if (fs.existsSync(videoSrc)) {
      fs.copyFileSync(videoSrc, bgDest);
      const isProcessed = videoSrc.includes('processed');
      console.log(`  + bg: ${v.bgVideo} (${(fs.statSync(bgDest).size/1024/1024).toFixed(1)} MB) ${isProcessed ? '[processed]' : '[original]'}`);
    } else {
      console.error(`  ! missing bg ${videoSrc}`);
      errors++;
    }
    if (fs.existsSync(audioSrc)) {
      fs.copyFileSync(audioSrc, bgmDest);
      console.log(`  + bgm: ${v.bgm}`);
    } else {
      console.error(`  ! missing bgm ${audioSrc}`);
      errors++;
    }
  } catch (e) {
    console.error(`  ! asset copy failed: ${e.message}`);
    errors++;
  }

  // Manifest
  const manifest = {
    id: v.id,
    slug,
    title: v.title,
    generatedAt: new Date().toISOString(),
    dataHash: hashContent(JSON.stringify(v)),
    templateHash: hashContent(template),
    duration,
    assets: {
      bgVideo: v.bgVideo,
      bgm: v.bgm,
      videoSrc: path.relative(ROOT, videoSrc),
      audioSrc: path.relative(ROOT, audioSrc),
      bgSize: fs.existsSync(bgDest) ? fs.statSync(bgDest).size : null,
      bgmSize: fs.existsSync(bgmDest) ? fs.statSync(bgmDest).size : null
    },
    template: 'template.html',
    hyperframes: 'hyperframes.json',
    status: fs.existsSync(outputPath) ? 'QUEUED' : 'GENERATED',
    qc: null,
    render: null
  };
  // If output already exists and QC passes, mark DONE
  if (fs.existsSync(outputPath) && preserveRenders) {
    const qc = qcVideo(outputPath, duration);
    manifest.status = qc.ok ? 'DONE' : 'GENERATED';
    manifest.qc = qc;
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  console.log(`  -> ${slug}/index.html ready`);
  logPipeline(`Generated ${slug}`, { status: manifest.status });
  generated++;
}

console.log(`\n✅ Generate complete: ${generated} generated, ${skipped} skipped, ${errors} errors`);
console.log(`   Use --force to regenerate all, --skip-preflight to skip asset checks`);
