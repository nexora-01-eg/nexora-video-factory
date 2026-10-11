import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACTORY_DIR = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(FACTORY_DIR, 'logs');

function ensureLogs() {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function ts() {
  return new Date().toISOString();
}

function write(file, line) {
  ensureLogs();
  fs.appendFileSync(path.join(LOGS_DIR, file), line + '\n', 'utf-8');
}

export function logPipeline(msg, meta = {}) {
  const line = `[${ts()}] [PIPELINE] ${msg} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`.trim();
  write('pipeline.log', line);
  console.log(line);
}

export function logRender(videoId, stage, msg, meta = {}) {
  const line = `[${ts()}] [${videoId}] [${stage}] ${msg} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`.trim();
  write('render.log', line);
  if (stage === 'ERROR' || stage === 'FAILED') write('errors.log', line);
}

export function logError(videoId, stage, error, retryCount = 0) {
  const line = `[${ts()}] [${videoId}] [${stage}] ERROR: ${error} (retry ${retryCount})`;
  write('errors.log', line);
  write('render.log', line);
  console.error(line);
}
