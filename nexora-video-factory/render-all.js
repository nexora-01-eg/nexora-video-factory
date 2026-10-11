#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateOrExit } from './lib/validate.js';
import { preflightAll } from './lib/preflight.js';
import { qcVideo } from './lib/qc.js';
import { loadState, saveState, initQueue, updateVideo, getQueued, getStatusSummary, STATUS, markRetry } from './lib/queue.js';
import { logPipeline, logRender, logError } from './lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VIDEOS_DIR = path.join(ROOT, 'videos');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

function parseArgs() {
  const raw = process.argv.slice(2);
  const cmd = raw[0] || 'render'; // render | status | retry-failed | qc | check | help
  const opts = {};
  for (let i = 1; i < raw.length; i++) {
    if (raw[i] === '--from' && raw[i+1]) { opts.from = parseInt(raw[++i]); }
    else if (raw[i] === '--to' && raw[i+1]) { opts.to = parseInt(raw[++i]); }
    else if (raw[i] === '--concurrency' && raw[i+1]) { opts.concurrency = parseInt(raw[++i]); }
    else if (raw[i] === '--force') opts.force = true;
    else if (raw[i] === '--skip-preflight') opts.skipPreflight = true;
    else if (raw[i] === '--skip-qc') opts.skipQc = true;
  }
  return { cmd, opts };
}

function loadVideos() {
  const videos = JSON.parse(fs.readFileSync(path.join(__dirname, 'videos.json'), 'utf-8'));
  return videos;
}

function filterRange(videos, opts) {
  if (opts.from !== undefined || opts.to !== undefined) {
    return videos.filter(v => {
      const n = parseInt(v.id);
      if (opts.from !== undefined && n < opts.from) return false;
      if (opts.to !== undefined && n > opts.to) return false;
      return true;
    });
  }
  return videos;
}

function doStatus() {
  const videos = loadVideos();
  initQueue(videos);
  const state = loadState();
  const summary = getStatusSummary(state);
  console.log('\n=== NEXORA VIDEO FACTORY — STATUS ===');
  console.log(`Total in state: ${summary.TOTAL} | Defined in videos.json: ${videos.length}`);
  console.log(`QUEUED: ${summary.QUEUED} | RENDERING: ${summary.RENDERING} | QC: ${summary.QC} | DONE: ${summary.DONE} | FAILED: ${summary.FAILED} | RETRYING: ${summary.RETRYING}`);
  const donePct = summary.TOTAL ? Math.round((summary.DONE / summary.TOTAL) * 100) : 0;
  const bar = '█'.repeat(Math.floor(donePct/5)) + '░'.repeat(20 - Math.floor(donePct/5));
  console.log(`${bar} ${donePct}%`);
  console.log('\nDetails:');
  for (const v of videos) {
    const s = state.videos[v.slug] || { status: 'UNKNOWN', retries: 0, fileSize: null };
    const size = s.fileSize ? ` ${(s.fileSize/1024/1024).toFixed(2)}MB` : '';
    const retry = s.retries ? ` retry=${s.retries}` : '';
    const err = s.lastError ? ` | ${s.lastError.slice(0, 60)}` : '';
    console.log(`  ${v.slug} [${s.status}]${size}${retry}${err} — ${v.title}`);
  }
}

function doRetryFailed() {
  const state = loadState();
  let reset = 0;
  for (const v of Object.values(state.videos)) {
    if (v.status === STATUS.FAILED) {
      v.status = STATUS.QUEUED;
      v.lastError = null;
      reset++;
    }
  }
  saveState(state);
  console.log(`Reset ${reset} FAILED → QUEUED. Now run: node render-all.js render`);
}

function doQc() {
  const videos = loadVideos();
  console.log('\n=== QC Check ===');
  for (const v of videos) {
    const out = path.join(VIDEOS_DIR, v.slug, 'renders', 'output.mp4');
    const duration = v.duration || CONFIG.expectedDuration;
    const result = qcVideo(out, duration);
    console.log(`  ${v.slug}: ${result.ok ? '✅ PASS' : '❌ FAIL'} ${result.error || ''}`);
    if (result.checks) {
      for (const c of result.checks.filter(x => !x.pass)) {
        console.log(`     - ${c.name}: ${c.error}`);
      }
    }
    // Update state if needed
    const state = loadState();
    if (state.videos[v.slug]) {
      if (result.ok && state.videos[v.slug].status !== STATUS.DONE) {
        updateVideo(v.slug, { status: STATUS.DONE, lastError: null });
      } else if (!result.ok && fs.existsSync(out)) {
        updateVideo(v.slug, { status: STATUS.FAILED, lastError: result.error });
      }
    }
  }
}

function doRender(opts) {
  const allVideos = loadVideos();
  validateOrExit(allVideos);

  if (!opts.skipPreflight) {
    console.log('\n[Preflight] Ensuring processed assets...');
    preflightAll(allVideos);
  }

  let videos = filterRange(allVideos, opts);
  // Init queue
  const state = initQueue(videos);
  // Determine queued set (respects DONE skipping)
  let queued = getQueued(videos, state);
  // Apply range again to queued
  queued = filterRange(queued, opts);

  if (opts.force) {
    queued = videos;
    for (const v of videos) updateVideo(v.slug, { status: STATUS.QUEUED, retries: 0, lastError: null });
  }

  if (queued.length === 0) {
    console.log('\n✅ Nothing to render (all DONE). Use --force to re-render or check status.');
    doStatus();
    return;
  }

  console.log(`\n=== RENDER QUEUE: ${queued.length} videos (concurrency ${opts.concurrency || CONFIG.concurrency}) ===`);
  queued.forEach(v => console.log(`  QUEUED: ${v.slug} — ${v.title}`));

  let success = 0, failed = 0, skipped = 0;

  for (const v of queued) {
    const dir = path.join(VIDEOS_DIR, v.slug);
    const out = path.join(dir, 'renders', 'output.mp4');
    const duration = v.duration || CONFIG.expectedDuration;

    // Check if already DONE and file passes QC and not force
    if (!opts.force) {
      const s = loadState().videos[v.slug];
      if (s && s.status === STATUS.DONE && fs.existsSync(out)) {
        const qc = qcVideo(out, duration);
        if (qc.ok) {
          console.log(`\n⏭️  ${v.slug} — SKIP (already DONE, QC ok)`);
          skipped++;
          continue;
        }
      }
    }

    console.log(`\n========== ${v.slug} — ${v.title} ==========`);
    updateVideo(v.slug, { status: STATUS.RENDERING });
    logRender(v.slug, 'RENDERING', 'start');
    const start = Date.now();

    try {
      // Ensure renders dir
      fs.mkdirSync(path.join(dir, 'renders'), { recursive: true });

      // Check hyperframes composition exists
      if (!fs.existsSync(path.join(dir, 'index.html'))) {
        throw new Error('index.html missing — run generate first');
      }

      // Render
      execSync(`npx --yes hyperframes@0.8.30 render --output renders/output.mp4`, { cwd: dir, stdio: 'inherit' });

      const elapsed = Date.now() - start;
      // QC
      if (!opts.skipQc) {
        updateVideo(v.slug, { status: STATUS.QC });
        console.log(`  [QC] Checking ${v.slug}...`);
        const qc = qcVideo(out, duration);
        if (!qc.ok) {
          throw new Error(`QC failed: ${qc.error}`);
        }
        console.log(`  [QC] ✅ PASS duration=${qc.checks.find(c=>c.name==='duration')?.value?.toFixed(1)}s`);
      }

      const stat = fs.statSync(out);
      updateVideo(v.slug, {
        status: STATUS.DONE,
        fileSize: stat.size,
        renderTimeMs: elapsed,
        lastError: null
      });

      // Update manifest
      const manifestPath = path.join(dir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        m.status = 'DONE';
        m.render = { elapsedMs: elapsed, fileSize: stat.size, renderedAt: new Date().toISOString() };
        m.qc = qcVideo(out, duration);
        fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2));
      }

      logRender(v.slug, 'DONE', `rendered ${(stat.size/1024/1024).toFixed(2)}MB in ${(elapsed/1000).toFixed(1)}s`);
      console.log(`✅ ${v.slug} DONE — ${(stat.size/1024/1024).toFixed(2)} MB in ${(elapsed/1000).toFixed(1)}s`);
      success++;

    } catch (e) {
      const msg = e.message.split('\n')[0].slice(0, 200);
      logError(v.slug, 'RENDER', msg, loadState().videos[v.slug]?.retries || 0);
      console.error(`❌ ${v.slug} FAILED: ${msg}`);

      // Retry logic
      const currentRetries = loadState().videos[v.slug]?.retries || 0;
      if (currentRetries < CONFIG.maxRetries - 1) {
        console.log(`  → Will retry (${currentRetries + 1}/${CONFIG.maxRetries}) on next run`);
        markRetry(v.slug, msg);
        failed++;
      } else {
        updateVideo(v.slug, { status: STATUS.FAILED, lastError: msg, retries: currentRetries + 1 });
        failed++;
      }
    }
  }

  console.log(`\n=== RENDER COMPLETE: ${success} success, ${failed} failed, ${skipped} skipped ===`);
  doStatus();
}

// Main
const { cmd, opts } = parseArgs();

switch (cmd) {
  case 'status':
    doStatus();
    break;
  case 'retry-failed':
    doRetryFailed();
    break;
  case 'qc':
    doQc();
    break;
  case 'check':
    // legacy: run hyperframes check on each
    {
      const videos = loadVideos();
      for (const v of filterRange(videos, opts)) {
        const dir = path.join(VIDEOS_DIR, v.slug);
        console.log(`\nChecking ${v.slug}...`);
        try { execSync(`npx --yes hyperframes@0.8.30 check`, { cwd: dir, stdio: 'inherit' }); } catch (e) { console.error(`Failed ${v.slug}`); }
      }
    }
    break;
  case 'render':
  case 'both':
  default:
    doRender(opts);
    break;
}
