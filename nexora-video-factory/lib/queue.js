import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACTORY_DIR = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(FACTORY_DIR, 'config.json'), 'utf-8'));
const STATE_PATH = path.join(FACTORY_DIR, CONFIG.stateFile);
const ROOT = path.resolve(FACTORY_DIR, '..');

export const STATUS = {
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  RENDERING: 'RENDERING',
  QC: 'QC',
  DONE: 'DONE',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING'
};

export function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { videos: {}, meta: { createdAt: new Date().toISOString(), version: '2.0' } };
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { videos: {}, meta: { createdAt: new Date().toISOString(), version: '2.0' } };
  }
}

export function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

export function initQueue(videos, { reset = false } = {}) {
  const state = loadState();
  if (reset) {
    state.videos = {};
  }
  for (const v of videos) {
    const id = v.slug;
    if (!state.videos[id]) {
      // Sync with filesystem: if manifest says DONE and output exists, initialize as DONE
      let initialStatus = STATUS.QUEUED;
      let fileSize = null;
      try {
        const manifestPath = path.join(ROOT, 'videos', id, 'manifest.json');
        const outPath = path.join(ROOT, 'videos', id, 'renders', 'output.mp4');
        if (fs.existsSync(manifestPath) && fs.existsSync(outPath)) {
          const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          if (m.status === 'DONE' && m.qc?.ok) {
            initialStatus = STATUS.DONE;
            fileSize = fs.statSync(outPath).size;
          } else if (fs.existsSync(outPath)) {
            try {
              const json = execSync(`ffprobe -v error -show_entries format=duration -of json "${outPath}"`, { stdio: 'pipe' }).toString();
              const d = JSON.parse(json);
              const dur = parseFloat(d.format.duration || 0);
              if (Math.abs(dur - (v.duration || CONFIG.expectedDuration)) < 1.0) {
                initialStatus = STATUS.DONE;
                fileSize = fs.statSync(outPath).size;
              }
            } catch {}
          }
        }
      } catch {}
      state.videos[id] = {
        id: v.id,
        slug: id,
        title: v.title,
        status: initialStatus,
        retries: 0,
        lastError: null,
        fileSize,
        renderTimeMs: null,
        duration: v.duration || CONFIG.expectedDuration,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
    } else {
      state.videos[id].title = v.title;
      state.videos[id].duration = v.duration || CONFIG.expectedDuration;
      try {
        const outPath = path.join(ROOT, 'videos', id, 'renders', 'output.mp4');
        const manifestPath = path.join(ROOT, 'videos', id, 'manifest.json');
        if (state.videos[id].status === STATUS.QUEUED && fs.existsSync(outPath) && fs.existsSync(manifestPath)) {
          const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          if (m.status === 'DONE' && m.qc?.ok) {
            state.videos[id].status = STATUS.DONE;
            state.videos[id].fileSize = fs.statSync(outPath).size;
          }
        }
      } catch {}
    }
  }
  // Remove videos not in current videos.json
  for (const key of Object.keys(state.videos)) {
    if (!videos.find(v => v.slug === key)) {
      // keep but mark orphan? For now keep
    }
  }
  saveState(state);
  return state;
}

export function updateVideo(slug, patch) {
  const state = loadState();
  if (!state.videos[slug]) state.videos[slug] = { slug, status: STATUS.QUEUED, retries: 0 };
  state.videos[slug] = { ...state.videos[slug], ...patch, updatedAt: new Date().toISOString() };
  saveState(state);
  return state.videos[slug];
}

export function getQueued(videos, state) {
  // Return videos that are QUEUED or RETRYING or FAILED with retries < max
  const result = [];
  for (const v of videos) {
    const s = state.videos[v.slug];
    if (!s) result.push(v);
    else if (s.status === STATUS.QUEUED || s.status === STATUS.RETRYING) result.push(v);
    else if (s.status === STATUS.FAILED && s.retries < CONFIG.maxRetries) result.push(v);
    // DONE is skipped
  }
  return result;
}

export function getStatusSummary(state) {
  const counts = { QUEUED: 0, PROCESSING: 0, RENDERING: 0, QC: 0, DONE: 0, FAILED: 0, RETRYING: 0, TOTAL: 0 };
  for (const v of Object.values(state.videos)) {
    counts[v.status] = (counts[v.status] || 0) + 1;
    counts.TOTAL++;
  }
  return counts;
}

export function shouldSkipRender(slug, state) {
  const s = state.videos[slug];
  if (!s) return false;
  if (s.status === STATUS.DONE) return true;
  return false;
}

export function markRetry(slug, error) {
  const state = loadState();
  const v = state.videos[slug];
  if (!v) return;
  v.retries = (v.retries || 0) + 1;
  v.lastError = error;
  if (v.retries >= CONFIG.maxRetries) {
    v.status = STATUS.FAILED;
  } else {
    v.status = STATUS.RETRYING;
  }
  v.updatedAt = new Date().toISOString();
  saveState(state);
  return v;
}

export function resetFailed(state) {
  for (const v of Object.values(state.videos)) {
    if (v.status === STATUS.FAILED) {
      v.status = STATUS.QUEUED;
      v.lastError = null;
    }
  }
  saveState(state);
}
