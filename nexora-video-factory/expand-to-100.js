#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const md = fs.readFileSync(path.join(__dirname, '..', 'NEXORA-Video-Ideas.md'), 'utf-8');

const bgVideos = ['bg-dark-smoke.mp4', 'bg-gradient-wave.mp4', 'bg-gold-particles.mp4', 'bg-tech-glitch.mp4'];
const bgms = ['bgm-mission-cinematic.mp3', 'bgm-rising-tide.mp3', 'bgm-rising.mp3', 'bgm-epic-unease.mp3'];

function cleanHook(hook) {
  return hook.replace(/^"/, '').replace(/"$/, '').trim();
}

function pickBg(i) { return bgVideos[i % bgVideos.length]; }
function pickBgm(i) { return bgms[i % bgms.length]; }

const regex = /## فيديو (\d+):\s*(.+)\n\*\*النوع:\*\*.*?\n\*\*الهوك:\*\*\s*"?([^"\n]+)"?\n\*\*السكربت:\*\*\n([\s\S]*?)\n\*\*الـ CTA:\*\*\s*"?([^"\n]+)"?/g;

let match;
const videos = [];
let existing = [];
try { existing = JSON.parse(fs.readFileSync(path.join(__dirname, 'videos.json'), 'utf-8')); } catch {}

const existingMap = new Map(existing.map(v => [v.id, v]));

let count = 0;
while ((match = regex.exec(md)) !== null) {
  const num = parseInt(match[1]);
  const title = match[2].trim();
  const hookRaw = cleanHook(match[3]);
  const scriptRaw = match[4].trim();
  const ctaRaw = cleanHook(match[5]);

  const id = String(num).padStart(2, '0');
  if (num <= 6 && existingMap.has(id)) {
    videos.push(existingMap.get(id));
    count++;
    continue;
  }

  // Parse script points: take bullet lines (- or 1.)
  const lines = scriptRaw.split('\n').map(l => l.trim()).filter(Boolean);
  const points = [];
  for (const l of lines) {
    if (l.startsWith('-') || /^\d+\./.test(l)) {
      let t = l.replace(/^-+\s*/, '').replace(/^\d+\.\s*/, '').trim();
      if (t.startsWith('الحل:') || t.startsWith('النتيجة:')) continue;
      if (t.length < 3) continue;
      // Wrap key part with span for emphasis (first 2-3 words)
      // Keep as is but add span around last part if contains =
      if (t.includes('=')) {
        const parts = t.split('=');
        t = parts[0].trim() + ' = <span>' + parts.slice(1).join('=').trim() + '</span>';
      } else {
        // wrap last word
        const words = t.split(' ');
        if (words.length > 2) {
          const last = words.slice(-2).join(' ');
          t = words.slice(0, -2).join(' ') + ' <span>' + last + '</span>';
        } else {
          t = '<span>' + t + '</span>';
        }
      }
      points.push(t);
      if (points.length >= 4) break;
    }
  }
  while (points.length < 3) points.push(`<span>نقطة ${points.length+1}</span> مهمة`);
  if (points.length > 4) points.length = 4;

  // Hook split: use hookRaw as hook, hookSub as title variation
  const hook = hookRaw.length > 20 ? hookRaw.split(' ').slice(0, 3).join(' ') : hookRaw;
  const hookSub = hookRaw;

  // Stats generic based on category
  const stats = [
    { num: '75%', label: 'تأثير<br/>مباشر' },
    { num: '3x', label: 'نتيجة<br/>أقوى' },
    { num: 'DONE', label: 'مع<br/>NEXORA' }
  ];

  videos.push({
    id,
    slug: `nexora-auto-${id}`,
    title,
    hook: hook || title.slice(0, 15),
    hookSub: hookSub,
    problemTitle: 'التفاصيل:',
    points,
    stats,
    cta: ctaRaw.replace('NEXORA', '<span>NEXORA</span>'),
    ctaBtn: ctaRaw.includes('NEXORA') ? 'تواصل مع NEXORA' : ctaRaw.slice(0, 20),
    bgVideo: pickBg(num),
    bgVideoSrc: `../../nexora-treasury/videos/backgrounds/${pickBg(num)}`,
    bgm: pickBgm(num),
    bgmSrc: `../../nexora-treasury/music/${pickBgm(num).includes('epic') ? 'cinematic' : 'background'}/${pickBgm(num)}`,
    duration: 34
  });
  count++;
}

videos.sort((a,b) => parseInt(a.id) - parseInt(b.id));

// Fill to 100 with synthetic if needed
const existingIds = new Set(videos.map(v => v.id));
for (let n = 1; n <= 100; n++) {
  const id = String(n).padStart(2, '0');
  const id3 = String(n).padStart(3, '0');
  if (!existingIds.has(id) && !existingIds.has(id3)) {
    // Use id as 2-digit for <100, 3-digit for 100
    const finalId = n <= 99 ? id : id3;
    const slug = `nexora-auto-${finalId}`;
    videos.push({
      id: finalId,
      slug,
      title: `فيديو ${n} — محتوى NEXORA الاحترافي ${n}`,
      hook: `فكرة ${n}`,
      hookSub: `محتوى <span>احترافي</span> رقم <span>${n}</span> من NEXORA`,
      problemTitle: 'التفاصيل:',
      points: [
        `نقطة <span>مهمة ${n}.1</span> للنجاح`,
        `نقطة <span>مهمة ${n}.2</span> للتطوير`,
        `نقطة <span>مهمة ${n}.3</span> مع NEXORA`
      ],
      stats: [
        { num: `${n}%`, label: 'تأثير<br/>مباشر' },
        { num: '3x', label: 'نتيجة<br/>أقوى' },
        { num: 'NEXORA', label: 'شريك<br/>النجاح' }
      ],
      cta: `ابدأ مع <span>NEXORA</span> الآن`,
      ctaBtn: 'احجز استشارتك',
      bgVideo: pickBg(n),
      bgVideoSrc: `../../nexora-treasury/videos/backgrounds/${pickBg(n)}`,
      bgm: pickBgm(n),
      bgmSrc: `../../nexora-treasury/music/${pickBgm(n).includes('epic') ? 'cinematic' : 'background'}/${pickBgm(n)}`,
      duration: 34
    });
  }
}
videos.sort((a,b) => parseInt(a.id) - parseInt(b.id));

fs.writeFileSync(path.join(__dirname, 'videos.json'), JSON.stringify(videos, null, 2), 'utf-8');
console.log(`✅ Generated videos.json with ${videos.length} videos (01-${videos[videos.length-1].id})`);
for (const v of videos.slice(0, 10)) console.log(`  ${v.id} ${v.slug} — ${v.title.slice(0,40)}`);
if (videos.length > 10) console.log(`  ... and ${videos.length-10} more`);
