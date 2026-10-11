import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACTORY_DIR = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(FACTORY_DIR, 'config.json'), 'utf-8'));

function run(cmd) {
  return execSync(cmd, { stdio: 'pipe', windowsHide: true }).toString();
}

export function qcVideo(outputPath, expectedDuration = CONFIG.expectedDuration) {
  const checks = [];
  let ok = true;

  // 1. File exists
  if (!fs.existsSync(outputPath)) {
    return { ok: false, checks: [{ name: 'exists', pass: false, error: 'file not found' }], error: 'file not found' };
  }

  const stat = fs.statSync(outputPath);
  checks.push({ name: 'fileSize', pass: stat.size > 500 * 1024, value: stat.size, error: stat.size <= 500 * 1024 ? `too small: ${stat.size}` : null });
  if (stat.size <= 500 * 1024) ok = false;
  if (stat.size > 150 * 1024 * 1024) {
    checks.push({ name: 'fileSizeUpper', pass: false, value: stat.size, error: 'too large >150MB' });
    ok = false;
  }

  // 2. ffprobe readability
  try {
    const json = run(`ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,avg_frame_rate,duration,codec_type -show_entries format=duration,size -of json "${outputPath}"`);
    const data = JSON.parse(json);
    const vStream = (data.streams || []).find(s => s.codec_type === 'video');
    const aStream = (data.streams || []).find(s => s.codec_type === 'audio');
    const format = data.format || {};

    // Duration
    const duration = parseFloat(format.duration || vStream?.duration || 0);
    const durationOk = Math.abs(duration - expectedDuration) < 1.0;
    checks.push({ name: 'duration', pass: durationOk, value: duration, expected: expectedDuration, error: durationOk ? null : `duration ${duration.toFixed(2)} != ${expectedDuration}` });
    if (!durationOk) ok = false;

    // Resolution
    if (vStream) {
      const resOk = vStream.width === CONFIG.expectedWidth && vStream.height === CONFIG.expectedHeight;
      checks.push({ name: 'resolution', pass: resOk, value: `${vStream.width}x${vStream.height}`, expected: `${CONFIG.expectedWidth}x${CONFIG.expectedHeight}`, error: resOk ? null : 'resolution mismatch' });
      if (!resOk) ok = false;

      const codecOk = vStream.codec_name === CONFIG.expectedVideoCodec;
      checks.push({ name: 'videoCodec', pass: codecOk, value: vStream.codec_name, expected: CONFIG.expectedVideoCodec, error: codecOk ? null : `codec ${vStream.codec_name}` });
      if (!codecOk) ok = false;

      const fps = vStream.r_frame_rate ? eval(vStream.r_frame_rate) : eval(vStream.avg_frame_rate);
      const fpsOk = Math.abs(fps - CONFIG.expectedFps) < 1;
      checks.push({ name: 'fps', pass: fpsOk, value: fps, expected: CONFIG.expectedFps, error: fpsOk ? null : `fps ${fps}` });
      if (!fpsOk) ok = false;
    } else {
      checks.push({ name: 'videoStream', pass: false, error: 'no video stream' });
      ok = false;
    }

    // Audio exists if expected
    if (!aStream) {
      checks.push({ name: 'audioStream', pass: false, error: 'no audio stream' });
      ok = false;
    } else {
      checks.push({ name: 'audioStream', pass: true, value: aStream.codec_name });
    }

  } catch (e) {
    checks.push({ name: 'readable', pass: false, error: e.message });
    return { ok: false, checks, error: `unreadable: ${e.message}` };
  }

  return { ok, checks, error: ok ? null : checks.filter(c => !c.pass).map(c => `${c.name}: ${c.error}`).join('; ') };
}

export function qcAndLog(videoId, outputPath, expectedDuration) {
  const result = qcVideo(outputPath, expectedDuration);
  return result;
}
