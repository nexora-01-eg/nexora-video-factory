import fs from 'fs';
import path from 'path';

const videos = [
  { id:'hf-3d-01', slug:'01-vanilla-gold', title:'VANILLA GOLD', sub:'WARM • LUXE • GOLDEN', bg:'linear-gradient(180deg,#1a1a1e 0%,#D6C3A5 100%)', accent:'#D6C3A5', desc:'فانيليا مدخنة بلمسة شامبين ذهبي', cta:'اطلب الآن — NEXORA', source:'gsap-3d-scroll' },
  { id:'hf-3d-02', slug:'02-matcha-frost', title:'MATCHA FROST', sub:'COOL • CLEAN • SHARP', bg:'linear-gradient(180deg,#0f1a14 0%,#6ee7b7 100%)', accent:'#6ee7b7', desc:'ماتشا ياباني مع نعناع ثلجي', cta:'جرّب الانتعاش', source:'gsap-3d-scroll' },
  { id:'hf-3d-03', slug:'03-berry-noir', title:'BERRY NOIR', sub:'DEEP • VELVET • NIGHT', bg:'linear-gradient(180deg,#1a1020 0%,#a78bfa 100%)', accent:'#a78bfa', desc:'توت أسود مع فانيليا سوداء', cta:'تذوّق الليل', source:'gsap-3d-scroll' },
  { id:'hf-3d-04', slug:'04-mocha-volt', title:'MOCHA VOLT', sub:'DARK • WARM • VOLT', bg:'linear-gradient(180deg,#1a120a 0%,#fb923c 100%)', accent:'#fb923c', desc:'موكا داكنة مع كراميل مملح', cta:'اشحن يومك', source:'gsap-3d-scroll' },
  { id:'hf-3d-05', slug:'05-citrus-flash', title:'CITRUS FLASH', sub:'ZEST • SPARK • FLASH', bg:'linear-gradient(180deg,#0f1a1a 0%,#22d3ee 100%)', accent:'#22d3ee', desc:'حمضيات يوزو مع زنجبيل', cta:'انطلق الآن', source:'gsap-3d-scroll' },
  { id:'hf-3d-06', slug:'06-nexora-hero', title:'NEXORA', sub:'منظومة تُحوّل مشروعك', bg:'linear-gradient(135deg,#020202 0%,#0a0a0a 50%,#151515 100%)', accent:'#D6C3A5', desc:'هوية فاخرة + موقع يحوّل + نظام مبيعات 24/7', cta:'احجز استشارة مجانية', source:'nexora-luxury-landing' },
  { id:'hf-3d-07', slug:'07-nexora-pricing', title:'باقات NEXORA', sub:'SPARK • GOLD • APEX', bg:'linear-gradient(135deg,#0a0a0a,#1a1a1e)', accent:'#D6C3A5', desc:'GOLD الأكثر طلباً — منظومة كاملة $3,200', cta:'ابدأ بـ GOLD →', source:'nexora-luxury-landing' },
  { id:'hf-3d-08', slug:'08-stripe-luxury', title:'Stripe × NEXORA', sub:'LUXURY STOREFRONT', bg:'linear-gradient(135deg,#020202,#080808)', accent:'#D6C3A5', desc:'حوّلنا Dashboard العادي لـ Luxury — GSAP + Glass', cta:'شوف التحوّل', source:'stripe-clone-luxury' },
  { id:'hf-3d-09', slug:'09-gsap-craft', title:'BUILT WITH GSAP', sub:'PIN • SCRUB • LENIS', bg:'linear-gradient(135deg,#060607,#0a0a12)', accent:'#6ee7b7', desc:'Pin + scrub 1.2 + transform only = 60fps', cta:'تعلّم التكنيك', source:'gsap-3d-scroll' },
  { id:'hf-3d-10', slug:'10-hub-showcase', title:'الـ 3 مشاريع', sub:'C • A • UPGRADE', bg:'linear-gradient(135deg,#020202,#151515)', accent:'#D6C3A5', desc:'3D Scroll + NEXORA + Stripe Luxury — كلهم Single-file', cta:'افتح الـ Hub الآن', source:'index-hub' },
];

const root = 'C:/Users/fagr/Documents/Default Project/videos-10-pack';

for (const v of videos) {
  const dir = path.join(root, v.slug);
  fs.mkdirSync(dir, { recursive: true });
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${v.title} — 30s HyperFrames</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@600;800&family=Syne:wght@700;800&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#020202}
.mono{font-family:'JetBrains Mono',monospace}
.syne{font-family:'Syne',sans-serif}
</style>
</head>
<body>
<div data-composition-id="${v.id}" data-width="1080" data-height="1920" data-duration="30000" data-start="0" style="width:1080px;height:1920px;position:relative;overflow:hidden;background:${v.bg}">
  <!-- full bleed bg -->
  <div style="position:absolute;inset:0;background:${v.bg}"></div>
  <div style="position:absolute;inset:0;opacity:.07;background-image:linear-gradient(to right, rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.08) 1px, transparent 1px);background-size:64px 64px"></div>
  <!-- glow -->
  <div style="position:absolute; width:900px;height:900px; left:50%; top:-120px; transform:translateX(-50%); background:radial-gradient(ellipse, ${v.accent}33, transparent 70%); filter:blur(40px)"></div>

  <!-- LOGO bar -->
  <div id="${v.id}-logo" style="position:absolute; top:48px; left:48px; right:48px; display:flex; align-items:center; justify-content:space-between">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="width:44px;height:44px;border-radius:14px;background:#fff;color:#0a0a0a;display:grid;place-items:center;font-weight:900;font-size:18px">N</span>
      <span style="color:#fff;font-weight:800;letter-spacing:-0.02em">NEXORA</span>
      <span style="padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.7);font-size:11px" class="mono">30s • 1080×1920</span>
    </div>
    <span style="padding:6px 12px;border-radius:999px;background:${v.accent};color:#0a0a0a;font-weight:800;font-size:11px" class="mono">${v.source}</span>
  </div>

  <!-- BOTTLE / VISUAL -->
  <div id="${v.id}-bottle" style="position:absolute; left:50%; top:52%; transform:translate(-50%,-50%)">
    <div style="width:260px;height:620px;border-radius:80px 80px 50px 50px; background:${v.bg}; border:1px solid rgba(255,255,255,.12); position:relative; box-shadow:0 40px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.25)">
      <div style="position:absolute; top:-22px; left:50%; transform:translateX(-50%); width:68px;height:30px; background:linear-gradient(180deg,#e8e8e8,#9a9a9a); border-radius:14px"></div>
      <div style="position:absolute; inset:0; border-radius:inherit; background:linear-gradient(90deg, rgba(255,255,255,.28) 0%, transparent 30%, transparent 70%, rgba(0,0,0,.22) 100%)"></div>
      <div style="position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:200px;height:280px; border-radius:18px; background:rgba(255,255,255,.96); display:grid; place-items:center; text-align:center; border:1px solid rgba(255,255,255,.3)">
        <div>
          <div class="mono" style="font-size:10px; letter-spacing:.18em; opacity:.5">NEXORA® — ${v.slug.split('-')[0].toUpperCase()}</div>
          <div class="syne" style="font-weight:900; font-size:28px; line-height:.9; margin-top:6px; color:#0a0a0a">${v.title.replace(' ','<br>')}</div>
          <div class="mono" style="font-size:11px; margin-top:8px; opacity:.6; color:#0a0a0a">${v.desc}</div>
        </div>
      </div>
    </div>
    <div style="position:absolute; left:50%; bottom:-28px; transform:translateX(-50%); width:200px;height:30px; background:rgba(0,0,0,.5); filter:blur(18px); border-radius:50%"></div>
  </div>

  <!-- TITLE -->
  <div id="${v.id}-title" style="position:absolute; left:48px; right:48px; top:220px; text-align:center">
    <div class="mono" style="font-size:12px; letter-spacing:.18em; color:rgba(255,255,255,.5)">${v.sub}</div>
    <h1 class="syne" style="font-weight:900; font-size:72px; line-height:.88; letter-spacing:-0.04em; margin-top:8px; color:#fff">${v.title}</h1>
    <p style="font-family:Alexandria,sans-serif; font-size:18px; color:rgba(255,255,255,.65); margin-top:12px; line-height:1.6">${v.desc}</p>
  </div>

  <!-- FEATURES -->
  <div id="${v.id}-features" style="position:absolute; left:48px; right:48px; bottom:340px; display:grid; grid-template-columns:repeat(3,1fr); gap:12px">
    <div style="padding:14px; border-radius:16px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); text-align:center"><div style="color:${v.accent}; font-weight:800">60fps</div><div class="mono" style="font-size:11px; color:rgba(255,255,255,.5)">GSAP only</div></div>
    <div style="padding:14px; border-radius:16px; background:${v.accent}; color:#0a0a0a; text-align:center"><div style="font-weight:900">30s</div><div class="mono" style="font-size:11px; opacity:.7">9:16 • Social</div></div>
    <div style="padding:14px; border-radius:16px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); text-align:center"><div style="color:#fff; font-weight:800">Single</div><div class="mono" style="font-size:11px; color:rgba(255,255,255,.5)">No build</div></div>
  </div>

  <!-- CTA -->
  <div id="${v.id}-cta" style="position:absolute; left:48px; right:48px; bottom:120px; text-align:center">
    <div style="display:inline-flex; align-items:center; gap:10px; padding:16px 28px; border-radius:999px; background:#fff; color:#0a0a0a; font-weight:900; font-size:16px">${v.cta} <span style="width:28px;height:28px; border-radius:50%; background:${v.accent}; display:grid; place-items:center">→</span></div>
    <div class="mono" style="font-size:11px; color:rgba(255,255,255,.35); margin-top:10px">HyperFrames • seek-safe • paused timeline • 1080×1920 • 30.000ms</div>
  </div>

  <!-- progress -->
  <div style="position:absolute; left:48px; right:48px; bottom:48px; height:3px; background:rgba(255,255,255,.08); border-radius:999px; overflow:hidden"><div id="${v.id}-bar" style="height:100%; width:0%; background:${v.accent}"></div></div>
</div>

<script>
(()=> {
  const id="${v.id}";
  const tl=gsap.timeline({paused:true});
  window.__timelines=window.__timelines||{};
  window.__timelines[id]=tl;
  // 0-4s logo in
  tl.fromTo("#"+id+"-logo", {autoAlpha:0, y:-16}, {autoAlpha:1, y:0, duration:0.6, ease:"power3.out"}, 0);
  // 0.4-1s title
  tl.fromTo("#"+id+"-title", {autoAlpha:0, y:24}, {autoAlpha:1, y:0, duration:0.8, ease:"power3.out"}, 0.4);
  // 0.8-1.6 bottle in with scale + rotateY
  tl.fromTo("#"+id+"-bottle", {autoAlpha:0, scale:0.9, rotationY:-18}, {autoAlpha:1, scale:1, rotationY:0, duration:1.1, ease:"power3.out"}, 0.8);
  // bottle float
  tl.to("#"+id+"-bottle", {y:-12, duration:1.2, ease:"sine.inOut", yoyo:true, repeat:6}, 1.6);
  tl.to("#"+id+"-bottle", {rotationY:10, duration:1.4, ease:"sine.inOut", yoyo:true, repeat:6}, 1.6);
  // 1.4 features
  tl.fromTo("#"+id+"-features", {autoAlpha:0, y:16}, {autoAlpha:1, y:0, duration:0.6, ease:"power3.out"}, 1.4);
  // 2s cta
  tl.fromTo("#"+id+"-cta", {autoAlpha:0, scale:0.96}, {autoAlpha:1, scale:1, duration:0.7, ease:"back.out(1.2)"}, 2.0);
  // progress bar 0-30s
  tl.to("#"+id+"-bar", {width:"100%", duration:28, ease:"none"}, 0);
  // hold
  tl.set({}, {}, 30);
})();
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  console.log('wrote', v.slug);
}
console.log('done 10');
