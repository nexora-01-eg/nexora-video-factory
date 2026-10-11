#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VIDEOS_DIR = path.join(ROOT, 'videos');

const videos = JSON.parse(fs.readFileSync(path.join(__dirname, 'videos.json'), 'utf-8'));
const template = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf-8');

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

for (const v of videos) {
  const slug = v.slug;
  const outDir = path.join(VIDEOS_DIR, slug);
  console.log(`\n=== Generating ${slug}: ${v.title} ===`);
  
  // clean & create
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });

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
    "videoNumber": v.id
  }, null, 2));

  // Copy assets (direct copy, not symlink for rendering reliability)
  const bgSrc = path.join(ROOT, 'nexora-treasury', 'videos', 'backgrounds', v.bgVideo);
  const musicFile = v.bgm;
  let musicSrc;
  // cinematic only if file is despair-triumph or epic-unease
  const cinematicFiles = ['bgm-despair-triumph.mp3', 'bgm-epic-unease.mp3'];
  if (cinematicFiles.includes(musicFile)) {
    musicSrc = path.join(ROOT, 'nexora-treasury', 'music', 'cinematic', musicFile);
  } else {
    musicSrc = path.join(ROOT, 'nexora-treasury', 'music', 'background', musicFile);
  }

  const bgDest = path.join(outDir, 'assets', v.bgVideo);
  const bgmDest = path.join(outDir, 'assets', v.bgm);

  if (fs.existsSync(bgSrc)) {
    fs.copyFileSync(bgSrc, bgDest);
    console.log(`  + bg: ${v.bgVideo} (${(fs.statSync(bgDest).size/1024/1024).toFixed(1)} MB)`);
  } else {
    console.error(`  ! missing bg ${bgSrc}`);
  }
  if (fs.existsSync(musicSrc)) {
    fs.copyFileSync(musicSrc, bgmDest);
    console.log(`  + bgm: ${v.bgm}`);
  } else {
    console.error(`  ! missing bgm ${musicSrc}`);
  }

  console.log(`  -> ${outDir}/index.html ready`);
}

console.log(`\n✅ Generated ${videos.length} projects in ${VIDEOS_DIR}`);
console.log(`Next: run "node nexora-video-factory/render-all.js" to check & render`);
