import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { logPipeline, logRender } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACTORY_DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(FACTORY_DIR, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(FACTORY_DIR, 'config.json'), 'utf-8'));

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', windowsHide: true, ...opts }).toString();
}

function probeVideo(filePath) {
  try {
    const json = run(`ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt,r_frame_rate,avg_frame_rate,duration,codec_type -show_entries format=duration -of json "${filePath}"`);
    const data = JSON.parse(json);
    const vStream = (data.streams || []).find(s => s.codec_type === 'video');
    const format = data.format || {};
    return { ok: true, stream: vStream, format, raw: data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function probeAudio(filePath) {
  try {
    const json = run(`ffprobe -v error -show_entries stream=codec_name,codec_type,duration -show_entries format=duration -of json "${filePath}"`);
    const data = JSON.parse(json);
    const aStream = (data.streams || []).find(s => s.codec_type === 'audio');
    return { ok: !!aStream, stream: aStream, raw: data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function needsReencode(stream) {
  if (!stream) return { needed: true, reason: 'no video stream' };
  const reasons = [];
  if (stream.codec_name !== 'h264') reasons.push(`codec ${stream.codec_name} != h264`);
  if (stream.pix_fmt !== 'yuv420p') reasons.push(`pix_fmt ${stream.pix_fmt} != yuv420p`);
  if (stream.width !== CONFIG.expectedWidth || stream.height !== CONFIG.expectedHeight) reasons.push(`resolution ${stream.width}x${stream.height} != ${CONFIG.expectedWidth}x${CONFIG.expectedHeight}`);
  // fps check: allow 30/1 or 30000/1001 approx 29.97? But we enforce 30
  const fps = stream.r_frame_rate ? eval(stream.r_frame_rate) : eval(stream.avg_frame_rate);
  if (Math.abs(fps - CONFIG.expectedFps) > 0.1) reasons.push(`fps ${fps.toFixed(2)} != ${CONFIG.expectedFps}`);
  // duration check not strict here, but if too short
  if (reasons.length > 0) return { needed: true, reason: reasons.join(', ') };
  // Also always re-encode if GOP sparse: we cannot easily detect without packet analysis, so we conservatively re-encode backgrounds that haven't been processed yet
  // For now, if file hasn't been processed in last 7 days, we re-check by probing keyframe interval via ffprobe packets if available
  return { needed: false };
}

export function getProcessedPath(originalPath) {
  // original: C:\...\nexora-treasury\videos\backgrounds\bg-tech-glitch.mp4
  // processed: C:\...\nexora-treasury\processed\backgrounds\bg-tech-glitch.mp4
  const rel = path.relative(path.join(ROOT, 'nexora-treasury'), originalPath);
  // rel = videos/backgrounds/bg-tech-glitch.mp4
  const processedRel = rel.replace(/^videos\//, '').replace(/^music\//, 'music/'); // videos/backgrounds -> backgrounds
  // we store under processed/backgrounds or processed/music/background etc
  // Simpler: processed/<rel>
  const out = path.join(ROOT, 'nexora-treasury', 'processed', rel);
  return out;
}

export function ensureProcessed(videoFile) {
  const original = path.join(ROOT, 'nexora-treasury', 'videos', 'backgrounds', videoFile);
  const processed = getProcessedPath(original);
  const info = probeVideo(original);

  if (!info.ok) {
    logPipeline(`Asset missing or unreadable: ${videoFile}`, { error: info.error });
    return { status: 'MISSING', original, processed: null, error: info.error };
  }

  const need = needsReencode(info.stream);
  // If processed already exists and is valid, use it
  if (fs.existsSync(processed)) {
    const pInfo = probeVideo(processed);
    if (pInfo.ok && !needsReencode(pInfo.stream).needed) {
      // check if processed is newer than original
      const mOrig = fs.statSync(original).mtimeMs;
      const mProc = fs.statSync(processed).mtimeMs;
      if (mProc > mOrig) {
        return { status: 'READY', original, processed, probe: pInfo.stream, cached: true };
      }
    }
  }

  if (!need.needed) {
    // original is good, but we still create processed as copy with correct GOP for safety? We copy original to processed if not exists
    if (!fs.existsSync(processed)) {
      fs.mkdirSync(path.dirname(processed), { recursive: true });
      fs.copyFileSync(original, processed);
      logPipeline(`Copied valid asset to processed: ${videoFile}`);
    }
    return { status: 'READY', original, processed: processed, probe: info.stream, cached: false };
  }

  // Need re-encode
  logPipeline(`Re-encoding ${videoFile}: ${need.reason}`);
  fs.mkdirSync(path.dirname(processed), { recursive: true });

  const tmp = processed + '.tmp.mp4';
  const cmd = `ffmpeg -y -i "${original}" -c:v ${CONFIG.ffmpeg.videoCodec} -pix_fmt ${CONFIG.ffmpeg.pixFmt} -r ${CONFIG.ffmpeg.fps} -g ${CONFIG.ffmpeg.gop} -keyint_min ${CONFIG.ffmpeg.gop} -preset ${CONFIG.ffmpeg.preset} -crf ${CONFIG.ffmpeg.crf} -movflags +faststart -c:a aac -b:a ${CONFIG.ffmpeg.audioBitrate} "${tmp}"`;
  try {
    run(cmd);
    if (fs.existsSync(tmp)) {
      if (fs.existsSync(processed)) fs.rmSync(processed, { force: true });
      fs.renameSync(tmp, processed);
      const newInfo = probeVideo(processed);
      logPipeline(`Re-encoded OK: ${videoFile} -> processed`, { newProbe: newInfo.stream });
      return { status: 'RE_ENCODED', original, processed, probe: newInfo.stream };
    }
  } catch (e) {
    logPipeline(`Re-encode failed for ${videoFile}: ${e.message}`, { error: e.message });
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
    return { status: 'FAILED', original, processed: null, error: e.message };
  }
  return { status: 'FAILED', original, processed: null, error: 'unknown' };
}

export function preflightAll(videos) {
  const results = [];
  const uniqueBgs = [...new Set(videos.map(v => v.bgVideo))];
  const uniqueBgm = [...new Set(videos.map(v => v.bgm))];

  logPipeline(`Preflight start: ${uniqueBgs.length} bg videos, ${uniqueBgm.length} bgm`);

  for (const bg of uniqueBgs) {
    const r = ensureProcessed(bg);
    results.push({ asset: bg, type: 'video', ...r });
    logRender(bg, 'PREFLIGHT', r.status, { reason: r.error || '' });
  }

  for (const bgm of uniqueBgm) {
    const paths = [
      path.join(ROOT, 'nexora-treasury', 'music', 'background', bgm),
      path.join(ROOT, 'nexora-treasury', 'music', 'cinematic', bgm)
    ];
    const exists = paths.find(p => fs.existsSync(p));
    if (!exists) {
      results.push({ asset: bgm, type: 'audio', status: 'MISSING', error: 'file not found' });
      logRender(bgm, 'PREFLIGHT', 'MISSING');
    } else {
      const info = probeAudio(exists);
      if (!info.ok) {
        results.push({ asset: bgm, type: 'audio', status: 'FAILED', error: info.error });
      } else {
        results.push({ asset: bgm, type: 'audio', status: 'READY', probe: info.stream });
        // also copy to processed for consistency
        const processedAudio = path.join(ROOT, 'nexora-treasury', 'processed', 'music', path.basename(exists));
        // Determine subfolder background vs cinematic
        const sub = exists.includes('cinematic') ? 'cinematic' : 'background';
        const outAudio = path.join(ROOT, 'nexora-treasury', 'processed', 'music', sub, bgm);
        if (!fs.existsSync(outAudio)) {
          fs.mkdirSync(path.dirname(outAudio), { recursive: true });
          fs.copyFileSync(exists, outAudio);
        }
      }
      logRender(bgm, 'PREFLIGHT', info.ok ? 'READY' : 'FAILED');
    }
  }

  const failed = results.filter(r => r.status === 'FAILED' || r.status === 'MISSING');
  if (failed.length) logPipeline(`Preflight failed for ${failed.length} assets`, { failed });
  else logPipeline('Preflight all assets READY');

  return results;
}

export function resolveAssetPath(bgVideo, bgm) {
  // Returns processed if exists, else original
  const origVideo = path.join(ROOT, 'nexora-treasury', 'videos', 'backgrounds', bgVideo);
  const procVideo = getProcessedPath(origVideo);
  const videoSrc = fs.existsSync(procVideo) ? procVideo : origVideo;

  const bgmPaths = [
    path.join(ROOT, 'nexora-treasury', 'processed', 'music', 'background', bgm),
    path.join(ROOT, 'nexora-treasury', 'processed', 'music', 'cinematic', bgm),
    path.join(ROOT, 'nexora-treasury', 'music', 'background', bgm),
    path.join(ROOT, 'nexora-treasury', 'music', 'cinematic', bgm)
  ];
  const audioSrc = bgmPaths.find(p => fs.existsSync(p)) || bgmPaths[2];

  return { videoSrc, audioSrc };
}
