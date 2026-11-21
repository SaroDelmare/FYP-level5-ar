/* Level 5 AR v2
   Scan a code card or the gear machine -> it locks on, freezes, and the card flies off the wall into your phone.
   Then you play it full screen: predict / fix / arcade on the cards, x-ray + challenge help on the gears.
   MindAR (image tracking) + A-Frame only for the camera part. Everything after the lock is plain DOM/SVG/canvas. */
'use strict';

/* =====================================================================
   BASICS
   ===================================================================== */
const COL = {
  neutral:'#EEF0F2', primary:'#1E55FF', accent:'#1D47B8', ink:'#15181D', light:'#F8F9FB', furniture:'#3E4451', wall:'#2A2E37',
  sky:'#D5DFFC', skyl:'#E7ECFB', p40:'#A1B7FD', p60:'#7597FD', g12:'#E2E3E7', g35:'#B7BAC0', g60:'#888C95', g75:'#6C717C',
  edge:'#545A65', soft:'#CACCD0', code:'#E1E2E5', hl:'#202328'
};
const F = { d:'Barlow, "Arial Narrow", sans-serif', b:'Figtree, system-ui, sans-serif', m:'"Source Code Pro", Menlo, monospace' };
const $ = id => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const back = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rand = (a, b) => a + Math.random() * (b - a);
const SVGNS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const params = new URLSearchParams(location.search);
const TIMESCALE = +params.get('timescale') || 1;     // tests only

/* canvas helpers */
function rr(c, x, y, w, hh, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + hh, r); c.arcTo(x + w, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function fillRR(c, x, y, w, hh, r, col) { rr(c, x, y, w, hh, r); c.fillStyle = col; c.fill(); }
function strokeRR(c, x, y, w, hh, r, col, lw) { rr(c, x, y, w, hh, r); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
function card(c, x, y, w, hh, r, fill, shadow = COL.primary, off = 8) { fillRR(c, x + off, y + off, w, hh, r, shadow); fillRR(c, x, y, w, hh, r, fill); strokeRR(c, x, y, w, hh, r, COL.ink, 4); }
function txt(c, s, x, y, font, col, align = 'left', base = 'alphabetic') { font = font.replace(/(\d+)px/, (m, n) => Math.max(+n, 26) + 'px'); c.font = font; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); }
function circle(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
function ring(c, x, y, r, col, lw) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.strokeStyle = col; c.lineWidth = lw; c.stroke(); }
function bolt(c, x, y, s, col) { c.beginPath(); c.moveTo(x + 2 * s, y - 10 * s); c.lineTo(x - 5 * s, y + 2 * s); c.lineTo(x, y + 2 * s); c.lineTo(x - 2 * s, y + 10 * s); c.lineTo(x + 5 * s, y - 2 * s); c.lineTo(x, y - 2 * s); c.closePath(); c.fillStyle = col; c.fill(); }
function person(c, x, y, s, opt = {}) {            // simple flat character: body + head + hair, eyes by mood
  const body = opt.body || COL.primary;
  fillRR(c, x - 62 * s, y, 124 * s, 110 * s, 40 * s, body);
  const hx = x + (opt.look || 0) * 14 * s, hy = y - 42 * s;
  circle(c, hx, hy, 44 * s, '#F1E3D3'); ring(c, hx, hy, 44 * s, COL.ink, 4 * s);
  c.beginPath(); c.arc(hx, hy, 44 * s, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(hx + 10 * s, hy - 20 * s); c.closePath(); c.fillStyle = COL.ink; c.fill();
  const m = opt.mood || 'ok'; c.strokeStyle = COL.ink; c.lineWidth = 4.5 * s; c.lineCap = 'round';
  if (m === 'sleep') { c.beginPath(); c.moveTo(hx - 22 * s, hy + 6 * s); c.lineTo(hx - 8 * s, hy + 6 * s); c.moveTo(hx + 8 * s, hy + 6 * s); c.lineTo(hx + 22 * s, hy + 6 * s); c.stroke(); }
  else if (m === 'panic') { circle(c, hx - 15 * s, hy + 4 * s, 8 * s, COL.light); ring(c, hx - 15 * s, hy + 4 * s, 8 * s, COL.ink, 3.5 * s); circle(c, hx + 15 * s, hy + 4 * s, 8 * s, COL.light); ring(c, hx + 15 * s, hy + 4 * s, 8 * s, COL.ink, 3.5 * s); circle(c, hx - 15 * s, hy + 4 * s, 3 * s, COL.ink); circle(c, hx + 15 * s, hy + 4 * s, 3 * s, COL.ink); c.beginPath(); c.ellipse(hx, hy + 26 * s, 8 * s, 6 * s, 0, 0, 7); c.fillStyle = COL.ink; c.fill(); }
  else { circle(c, hx - 15 * s, hy + 5 * s, 5 * s, COL.ink); circle(c, hx + 15 * s, hy + 5 * s, 5 * s, COL.ink);
    c.beginPath(); if (m === 'happy') c.arc(hx, hy + 16 * s, 12 * s, .15 * Math.PI, .85 * Math.PI); else if (m === 'sad') c.arc(hx, hy + 32 * s, 10 * s, 1.2 * Math.PI, 1.8 * Math.PI); else { c.moveTo(hx - 8 * s, hy + 24 * s); c.lineTo(hx + 8 * s, hy + 24 * s); } c.stroke(); }
}

/* sound + haptics (unlocked by the first tap) */
let AC = null;
function audioInit() { if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
function blip(f, d = .06, type = 'triangle', vol = .05, delay = 0) {
  if (!AC) return; try { const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d); } catch (e) {}
}
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const sfx = {
  step: () => blip(880, .03, 'square', .012), tap: () => blip(1200, .03, 'sine', .04),
  tru: () => blip(1046, .09, 'triangle', .05), fal: () => blip(330, .09, 'triangle', .04),
  err: () => { blip(140, .25, 'sawtooth', .05); buzz(120); },
  ok: () => { blip(784, .1, 'triangle', .06); blip(1175, .14, 'triangle', .06, .08); },
  no: () => { blip(260, .12, 'triangle', .05); blip(196, .16, 'triangle', .05, .1); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => blip(f, .18, 'triangle', .06, i * .09)),
  coin: () => blip(1568 + Math.random() * 300, .05, 'square', .02),
  ping: () => { blip(1318, .07, 'sine', .05); blip(1760, .09, 'sine', .04, .05); },
  key: () => blip(2000 + Math.random() * 400, .015, 'square', .012),
  lock: () => { blip(660, .06, 'sine', .06); blip(990, .1, 'sine', .06, .07); buzz(30); },
  whoosh: () => { if (!AC) return; try { const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(1200, t + .35); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .1); g.gain.exponentialRampToValueAtTime(.0001, t + .4); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + .42); } catch (e) {} },
  clunk: () => { blip(180, .08, 'square', .04); buzz(15); },
};

/* =====================================================================
   STAMPS (one per card + the gears; all 5 = finish screen)
   ===================================================================== */
const STAMP_IDS = ['broke', 'procrastination', 'deadline', 'lecture', 'gears'];
const stamps = (() => { let s = []; try { s = JSON.parse(localStorage.getItem('l5ar-stamps') || '[]'); } catch (e) {} return new Set(s.filter(x => STAMP_IDS.includes(x))); })();
function renderStamps(pop) {
  document.querySelectorAll('[data-stamps]').forEach(el => {
    el.innerHTML = ''; STAMP_IDS.forEach(id => { const i = h('i'); if (stamps.has(id)) i.className = 'on' + (id === pop ? ' pop' : ''); el.appendChild(i); });
  });
  document.querySelectorAll('[data-target]').forEach(el => el.classList.toggle('done', stamps.has(el.dataset.target)));
}
function award(id) {
  if (stamps.has(id)) return false;
  stamps.add(id); try { localStorage.setItem('l5ar-stamps', JSON.stringify([...stamps])); } catch (e) {}
  renderStamps(id); sfx.win(); confetti(); buzz([20, 40, 20]);
  if (stamps.size === STAMP_IDS.length) setTimeout(() => showFinish(), 2600);
  return true;
}

/* =====================================================================
   TARGETS: index in targets.mind -> what it opens
   ===================================================================== */
const TARGETS = [
  { kind: 'card', card: 0, img: 'targets/card0.png', aspect: 412 / 640, label: 'broke.py', stamp: 'broke' },
  { kind: 'card', card: 1, img: 'targets/card1.png', aspect: 412 / 640, label: 'procrastination.py', stamp: 'procrastination' },
  { kind: 'card', card: 2, img: 'targets/card2.png', aspect: 412 / 640, label: 'deadline.py', stamp: 'deadline' },
  { kind: 'card', card: 3, img: 'targets/card3.png', aspect: 412 / 640, label: 'lecture.py', stamp: 'lecture' },
  { kind: 'gears', img: 'targets/gears.png', aspect: 809 / 1024, label: 'Gear machine', stamp: 'gears' },
];
function cardSVG(i) {
  const s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('viewBox', '0 0 640 412'); s.innerHTML = ART.cards[i]; return s;
}

/* =====================================================================
   SCREENS
   ===================================================================== */
const SCREENS = ['start', 'cam', 'lock', 'play', 'finish'];
function show(...names) { SCREENS.forEach(n => $(n).hidden = !names.includes(n)); }
function fillTargets() {
  const st = $('startTargets'), mini = $('camMini'); st.innerHTML = ''; mini.innerHTML = '';
  TARGETS.forEach((t, i) => {
    const d = h('button', 't'); d.dataset.target = t.stamp; d.style.cssText = 'appearance:none;padding:0;cursor:pointer;text-align:left';
    d.innerHTML = `<img src="${t.img}" alt=""><b>${t.label}</b>`; d.onclick = () => { audioInit(); openTarget(i, null); }; st.appendChild(d);
    const m = h('img'); m.src = t.img; m.alt = t.label; m.dataset.target = t.stamp; mini.appendChild(m);
  });
  // 6th tile on the start grid: progress
  const p = h('div', 't'); p.style.cssText = 'display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;background:var(--ink);color:var(--light);box-shadow:3px 4px 0 var(--accent)';
  p.innerHTML = `<span style="font:700 30px/1 var(--display)" id="stampCount">0/5</span><span style="font:600 10px/1 var(--mono);letter-spacing:.12em">STAMPS</span>`; st.appendChild(p);
}
function updateCount() { const e = $('stampCount'); if (e) e.textContent = `${stamps.size}/5`; }

/* =====================================================================
   AR: scan -> lock -> freeze -> fly
   ===================================================================== */
const ar = { scene: null, sys: null, ready: false, started: false, paused: false, active: null, acquire: null, locking: false };
const LOCK_MS = 750;

AFRAME.registerComponent('l5-target', {
  schema: { index: { type: 'int' } },
  init() {
    this.el.addEventListener('targetFound', () => onFound(this.data.index, this.el));
    this.el.addEventListener('targetLost', () => onLost(this.data.index));
  },
});
function buildScene() {
  const sc = document.createElement('a-scene');
  sc.setAttribute('mindar-image', 'imageTargetSrc: targets/targets.mind; maxTrack: 1; autoStart: false; uiLoading: no; uiScanning: no; uiError: no; filterMinCF: 0.0001; filterBeta: 0.001; missTolerance: 6; warmupTolerance: 3');
  sc.setAttribute('renderer', 'colorManagement: true; antialias: true; alpha: true');
  sc.setAttribute('vr-mode-ui', 'enabled: false');
  sc.setAttribute('device-orientation-permission-ui', 'enabled: false');
  sc.setAttribute('loading-screen', 'enabled: false');
  sc.innerHTML = '<a-camera position="0 0 0" look-controls="enabled: false"></a-camera>' +
    TARGETS.map((t, i) => `<a-entity mindar-image-target="targetIndex: ${i}" l5-target="index: ${i}"></a-entity>`).join('');
  $('scene').appendChild(sc);
  return sc;
}
async function startCamera() {
  audioInit();
  if (ar.started) { resumeCamera(); return; }
  ar.started = true;
  const go = $('goBtn'); go.querySelector('span').textContent = 'Starting camera…'; go.disabled = true;
  await Promise.all([document.fonts.load(`700 30px ${F.d}`), document.fonts.load(`400 20px ${F.m}`), document.fonts.load(`700 20px ${F.b}`)].map(p => p.catch(() => {})));
  const sc = ar.scene = buildScene();
  const begin = () => {
    ar.sys = sc.systems['mindar-image-system'];
    sc.addEventListener('arReady', () => { ar.ready = true; go.disabled = false; go.querySelector('span').textContent = 'Start scanning'; show('cam'); camText(); });
    sc.addEventListener('arError', () => { ar.started = false; go.disabled = false; go.querySelector('span').textContent = 'Camera blocked. Allow it, then tap again'; });
    ar.sys.start();
  };
  if (sc.hasLoaded) begin(); else sc.addEventListener('loaded', begin);
}
function resumeCamera() {
  $('scene').style.visibility = 'visible';
  if (ar.paused && ar.sys) { ar.sys.unpause(); ar.paused = false; }
  ar.active = null; ar.acquire = null; ar.locking = false; $('vf').classList.remove('found'); setRing(0);
  show('cam'); camText();
}
function camText(title, text) {
  $('camTitle').textContent = title || 'Point at a code card';
  $('camText').textContent = text || 'Or at the gear machine. Hold still for a second and it locks on.';
}
function setRing(k) { $('ringArc').setAttribute('stroke-dashoffset', (213.6 * (1 - k)).toFixed(1)); }
function toast(s, ms = 1600) { const t = $('toast'); t.textContent = s; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms); }

function onFound(i, el) {
  if (ar.locking || $('cam').hidden) return;
  ar.active = { i, el }; $('vf').classList.add('found');
  camText(TARGETS[i].label, 'Got it. Hold still…'); blip(660, .05, 'sine', .04);
  const t0 = performance.now(); ar.acquire = t0;
  const loop = now => {
    if (ar.acquire !== t0 || !ar.active || ar.active.i !== i) return;
    const k = clamp((now - t0) / LOCK_MS, 0, 1); setRing(k);
    if (k >= 1) lockOn(i, el); else requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function onLost(i) {
  if (!ar.active || ar.active.i !== i || ar.locking) return;
  ar.active = null; ar.acquire = null; $('vf').classList.remove('found'); setRing(0); camText(null, 'Lost it. Keep the whole card in the frame.');
}

/* project the target's 4 corners to screen px (TL, TR, BR, BL) */
function projectQuad(el, aspect) {
  const THREE = AFRAME.THREE, cam = ar.scene.camera, rect = ar.scene.renderer.domElement.getBoundingClientRect();
  el.object3D.updateMatrixWorld(true);
  return [[-.5, aspect / 2], [.5, aspect / 2], [.5, -aspect / 2], [-.5, -aspect / 2]].map(([x, y]) => {
    const v = new THREE.Vector3(x, y, 0).applyMatrix4(el.object3D.matrixWorld).project(cam);
    return [rect.left + (v.x + 1) / 2 * rect.width, rect.top + (1 - v.y) / 2 * rect.height];
  });
}
function snapshot() {
  const cv = $('snap'), dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr);
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const v = document.querySelector('#scene video');
  if (v) { const r = v.getBoundingClientRect(); try { c.drawImage(v, r.left, r.top, r.width, r.height); } catch (e) {} }
  cv.style.opacity = 1; cv.style.filter = 'none';
}
/* CSS matrix3d that maps a w x h box onto a quad (TL, TR, BR, BL) */
function quadMatrix(w, hh, q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, k;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) { a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0; g = 0; k = 0; }
  else { const den = dx1 * dy2 - dx2 * dy1; g = (dx3 * dy2 - dx2 * dy3) / den; k = (dx1 * dy3 - dx3 * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + k * x3; c = x0; d = y1 - y0 + g * y1; e = y3 - y0 + k * y3; f = y0; }
  a /= w; d /= w; g /= w; b /= hh; e /= hh; k /= hh;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${k},0,0,1,0,${c},${f},0,1)`;
}
function rectQuad(r) { return [[r.left, r.top], [r.right, r.top], [r.right, r.bottom], [r.left, r.bottom]]; }

function lockOn(i, el) {
  if (ar.locking) return; ar.locking = true; sfx.lock();
  let quad = null; try { quad = projectQuad(el, TARGETS[i].aspect); } catch (e) { quad = null; }
  snapshot();
  try { ar.sys.pause(false); ar.paused = true; } catch (e) {}
  $('scene').style.visibility = 'hidden';
  openTarget(i, quad);
}

/* fly the target from where it sits in the photo into its slot in the play view */
function openTarget(i, quad) {
  const t = TARGETS[i], play = $('play');
  play.style.transition = 'none'; play.style.opacity = quad ? 0 : 1;
  show(...(quad ? ['lock', 'play'] : ['play']));         // visible (but transparent) so the slot can be measured
  buildPlay(i);
  const slot = playSlot();
  if (!quad || !slot || slot.width < 10) { show('play'); play.style.opacity = 1; viewStart(); return; }
  const W0 = 640, H0 = W0 * t.aspect;
  const fly = h('div', 'fly'); fly.style.width = W0 + 'px'; fly.style.height = H0 + 'px';
  if (t.kind === 'card') { const s = cardSVG(t.card); s.style.cssText = 'width:100%;height:100%;display:block;border-radius:14px'; fly.appendChild(s); }
  else { const im = h('img'); im.src = t.img; im.style.cssText = 'width:100%;height:100%;display:block'; fly.appendChild(im); }
  fly.style.opacity = 0; $('lock').appendChild(fly);
  const target = rectQuad(slot), snap = $('snap'), flash = $('flash');
  const T0 = performance.now(), D1 = 220, D2 = 680;
  sfx.whoosh();
  const frame = now => {
    const e = now - T0;
    if (e < D1) {                                   // 1. snap the clean art onto the real card in the photo
      const k = e / D1; fly.style.opacity = k; fly.style.transform = quadMatrix(W0, H0, quad);
      flash.style.opacity = .35 * Math.sin(k * Math.PI);
    } else {                                        // 2. fly it into place while the photo melts into the wall colour
      const k = clamp((e - D1) / D2, 0, 1), q = ease(k);
      fly.style.opacity = 1; flash.style.opacity = 0;
      fly.style.transform = quadMatrix(W0, H0, quad.map((p, j) => [lerp(p[0], target[j][0], q), lerp(p[1], target[j][1], q)]));
      snap.style.opacity = 1 - q; snap.style.filter = `blur(${q * 14}px)`;
      play.style.opacity = clamp((k - .55) / .45, 0, 1);
      if (k >= 1) { fly.remove(); show('play'); play.style.opacity = 1; viewStart(); return; }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* =====================================================================
   PLAY VIEW
   ===================================================================== */
let view = null;          // current card/gear controller
let rafId = 0, lastT = 0;
function buildPlay(i) {
  if (view && view.destroy) view.destroy();
  cancelAnimationFrame(rafId);
  const t = TARGETS[i], body = $('playBody'); body.innerHTML = '';
  $('ttlFile').textContent = t.kind === 'card' ? CARDS[t.card].file : 'Gear machine';
  $('ttlConcept').textContent = t.kind === 'card' ? CARDS[t.card].concept : 'x-ray + challenge help';
  view = t.kind === 'card' ? makeCardView(CARDS[t.card], t) : makeGearView(t);
  view.build(body);
}
function playSlot() { return view && view.slot ? view.slot() : null; }
function viewStart() {
  if (!view) return; view.start && view.start();
  lastT = performance.now();
  const tick = now => { const dt = Math.min(64, now - lastT) * TIMESCALE; lastT = now; view && view.tick && view.tick(dt, now); rafId = requestAnimationFrame(tick); };
  rafId = requestAnimationFrame(tick);
}
function leavePlay() {
  if (view && view.destroy) view.destroy(); view = null; cancelAnimationFrame(rafId);
  if (ar.started && ar.ready) resumeCamera(); else { show('start'); updateCount(); }
}

/* ---------- the card overlay: debugger bar, chips, tappable lines, patches ---------- */
const LINE_Y = n => 89 + (n - 1) * 36;
function Tracer(wrap, nLines) {
  const ov = sv('svg', { class: 'ov', viewBox: '0 0 640 412' }); wrap.appendChild(ov);
  const dim = sv('g', {}, ov), patches = sv('g', {}, ov), barG = sv('g', { opacity: 0 }, ov), inserts = sv('g', {}, ov), chips = sv('g', {}, ov), hits = sv('g', {}, ov);
  sv('rect', { x: 0, y: -18, width: 640, height: 36, fill: COL.primary, opacity: .34 }, barG);
  sv('rect', { x: 0, y: -18, width: 7, height: 36, fill: COL.primary }, barG);
  barG.style.transition = 'transform .22s cubic-bezier(.3,.9,.3,1), opacity .2s';
  let chipEls = {};
  const api = {
    hl(n) { if (!n) { barG.setAttribute('opacity', 0); return; } barG.setAttribute('opacity', 1); barG.style.transform = `translateY(${LINE_Y(n)}px)`; },
    chip(n, label, kind) {
      if (chipEls[n]) { chipEls[n].remove(); delete chipEls[n]; }
      if (!label) return;
      kind = kind || (label === 'True' ? 'true' : label === 'False' ? 'false' : 'err');
      const w = kind === 'err' ? 18 + label.length * 10.4 : 22 + label.length * 11, x = 640 - 10 - w, y = LINE_Y(n);
      const g = sv('g', { transform: `translate(${x + w / 2},${y})` }, chips);
      const inner = sv('g', {}, g); inner.style.animation = 'chipPop .35s cubic-bezier(.2,1.6,.4,1)';
      sv('rect', { x: -w / 2, y: -14, width: w, height: 28, rx: 14, fill: kind === 'true' ? COL.primary : kind === 'false' ? COL.furniture : COL.light, stroke: kind === 'err' ? COL.primary : 'none', 'stroke-width': 3 }, inner);
      const t = sv('text', { x: 0, y: 6.5, 'text-anchor': 'middle', 'font-family': F.m, 'font-weight': 600, 'font-size': 17, fill: kind === 'err' ? COL.primary : COL.light }, inner); t.textContent = label;
      chipEls[n] = g;
    },
    clearChips() { for (const n in chipEls) chipEls[n].remove(); chipEls = {}; },
    dimLines(lines) { dim.innerHTML = ''; (lines || []).forEach(n => sv('rect', { x: 0, y: LINE_Y(n) - 18, width: 640, height: 36, fill: COL.ink, opacity: .7 }, dim)); },
    /* replace a whole printed line with new code (tokens: [[text, colour]]) */
    patch(n, tokens, flash) {
      patches.querySelectorAll(`[data-line="${n}"]`).forEach(e => e.remove());
      if (!tokens) return;
      const g = sv('g', { 'data-line': n }, patches);
      sv('rect', { x: 5, y: LINE_Y(n) - 18, width: 635, height: 36, fill: COL.hl }, g);
      const t = sv('text', { x: 58, y: LINE_Y(n) + 7, 'font-family': F.m, 'font-size': 20, 'xml:space': 'preserve' }, g); t.style.whiteSpace = 'pre';
      tokens.forEach(([s, col]) => { const sp = sv('tspan', { fill: col }, t); sp.textContent = s; });
      if (flash) { const r = sv('rect', { x: 0, y: LINE_Y(n) - 18, width: 640, height: 36, fill: COL.primary, opacity: .7 }, g); r.style.transition = 'opacity .7s'; requestAnimationFrame(() => requestAnimationFrame(() => r.setAttribute('opacity', 0))); }
    },
    /* a new line squeezed in between line n and n+1 (procrastination) */
    insert(n, text, indent, state) {
      inserts.innerHTML = ''; if (text == null) return;
      const y = LINE_Y(n) + 18, x = 58 + indent * 12;
      const g = sv('g', {}, inserts);
      sv('rect', { x: 46, y: y - 1.5, width: 594, height: 3, fill: COL.primary }, g);
      const w = 30 + text.length * 12;
      sv('rect', { x: x - 10, y: y - 15, width: w, height: 30, rx: 8, fill: state === 'bad' ? COL.furniture : COL.primary, stroke: COL.light, 'stroke-width': 2.5 }, g);
      const t = sv('text', { x: x + 5, y: y + 6.5, 'font-family': F.m, 'font-weight': 600, 'font-size': 19, fill: COL.light }, g); t.textContent = text;
      if (state === 'skip' || state === 'bad') { sv('line', { x1: x - 4, y1: y, x2: x + w - 16, y2: y, stroke: COL.light, 'stroke-width': 3 }, g); }
      g.style.animation = 'chipPop .35s cubic-bezier(.2,1.6,.4,1)';
    },
    /* make some lines tappable (for predictions) */
    tappable(lines, cb) {
      hits.innerHTML = '';
      (lines || []).forEach(n => {
        const g = sv('g', { style: 'cursor:pointer' }, hits);
        const r = sv('rect', { x: 46, y: LINE_Y(n) - 17, width: 588, height: 34, rx: 7, fill: 'rgba(30,85,255,.12)', stroke: COL.p40, 'stroke-width': 2.5, 'stroke-dasharray': '7 5' }, g);
        r.style.animation = 'tapPulse 1.4s ease-in-out infinite';
        sv('rect', { x: 0, y: LINE_Y(n) - 26, width: 640, height: 52, fill: 'transparent' }, g);
        g.addEventListener('click', () => { sfx.tap(); cb(n); });
      });
    },
    reset() { api.hl(null); api.clearChips(); api.dimLines(); api.insert(null); api.tappable(); patches.innerHTML = ''; },
  };
  return api;
}
(() => { const s = document.createElement('style'); s.textContent = '@keyframes chipPop{0%{transform:scale(.3)}100%{transform:scale(1)}}@keyframes tapPulse{0%,100%{opacity:.55}50%{opacity:1}}'; document.head.appendChild(s); })();

/* step runner: plays a list of {line, wait, chip, fn, sfx} */
function Runner(tr) {
  let q = [], wait = 0;
  const exec = s => {
    if ('line' in s) tr.hl(s.line);
    if (s.chip) tr.chip(...s.chip);
    if (s.fn) s.fn();
    if (s.out && tr.out) tr.out(s.out, s.kind);
    if (s.sfx) sfx[s.sfx](); else if (s.line) sfx.step();
  };
  return {
    run(steps) { q = steps.slice(); wait = 0; }, push(...s) { q.push(...s); }, clear() { q = []; wait = 0; },
    get busy() { return q.length > 0; },
    update(dt) { wait -= dt; while (wait <= 0 && q.length) { const s = q.shift(); exec(s); wait += (s.wait ?? 600); } },
  };
}

/* ---------- generic card view: card on top, stage in the middle, panel at the bottom ---------- */
function makeCardView(def, target) {
  const v = { def, target, t: 0 };
  v.build = body => {
    const wrap = h('div', 'cardwrap'); wrap.appendChild(cardSVG(target.card)); body.appendChild(wrap);
    const stage = h('div', 'stage'), scene = h('div', 'scene'), cv = h('canvas'), con = h('div', 'console', '<span class="hd">OUTPUT</span>');
    scene.appendChild(cv); stage.append(scene, con); body.appendChild(stage); v.con = con;
    const panel = h('div', 'panel'); body.appendChild(panel);
    v.wrap = wrap; v.cv = cv; v.stage = stage; v.panel = panel;
    v.tr = Tracer(wrap); v.tr.out = (s, k) => v.out(s, k); v.run = Runner(v.tr);
    v.ui = makePanel(panel);
    v.ctx = cv.getContext('2d');
    v.resize = () => { const r = scene.getBoundingClientRect(), dpr = Math.min(2.5, devicePixelRatio || 1); cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); v.sw = r.width; v.sh = r.height; };
    v.resize(); v.ro = new ResizeObserver(() => v.resize()); v.ro.observe(scene);
    cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); const p = v.toDesign(e.clientX - r.left, e.clientY - r.top); def.onStageTap && def.onStageTap(v, p.x, p.y); });
    def.init(v);
  };
  /* scenes are drawn in a 1000 x 560 design box, scaled to fit the stage */
  v.toDesign = (x, y) => { const s = Math.min(v.sw / 1000, v.sh / 560), ox = (v.sw - 1000 * s) / 2, oy = (v.sh - 560 * s) / 2; return { x: (x - ox) / s, y: (y - oy) / s }; };
  v.slot = () => v.wrap.getBoundingClientRect();
  v.out = (s, kind) => { const d = h('div', 'ln' + (kind ? ' ' + kind : '')); d.textContent = s; v.con.appendChild(d); const lines = v.con.querySelectorAll('.ln'); if (lines.length > 6) lines[0].remove(); };
  v.clearOut = () => v.con.querySelectorAll('.ln').forEach(e => e.remove());
  v.start = () => def.start(v);
  v.tick = (dt) => {
    v.t += dt / 1000; v.run.update(dt); def.update && def.update(v, dt);
    const c = v.ctx, dpr = v.cv.width / v.sw; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, v.sw, v.sh);
    c.fillStyle = COL.light; c.fillRect(0, 0, v.sw, v.sh);
    const s = Math.min(v.sw / 1000, v.sh / 560); c.translate((v.sw - 1000 * s) / 2, (v.sh - 560 * s) / 2); c.scale(s, s);
    def.draw(v, c);
  };
  v.destroy = () => { v.ro && v.ro.disconnect(); def.destroy && def.destroy(v); };
  return v;
}
/* bottom panel: eyebrow + text + buttons */
function makePanel(panel) {
  const pr = h('div', 'prompt'), ch = h('div', 'choices'); panel.append(pr, ch);
  return {
    say(eyebrow, html, kind) { pr.className = 'prompt' + (kind ? ' ' + kind : ''); pr.innerHTML = (eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : '') + `<p>${html}</p>`; },
    clear() { ch.innerHTML = ''; ch.className = 'choices'; },
    row(on) { ch.classList.toggle('row', !!on); },
    grid(on) { ch.classList.toggle('grid', !!on); },
    choice(n, code, sub, cb) {
      const b = h('button', 'choice', `${n != null ? `<span class="n">${n}</span>` : ''}<span class="c">${code}${sub ? `<small>${sub}</small>` : ''}</span>`);
      b.onclick = () => { audioInit(); sfx.tap(); cb(b); }; ch.appendChild(b); return b;
    },
    button(label, cb, cls = '') { const b = h('button', 'btn ' + cls, label); b.onclick = () => { audioInit(); cb(b); }; ch.appendChild(b); return b; },
    dots(n, k) { const d = h('div', 'dots'); for (let i = 0; i < n; i++) d.appendChild(h('i', i < k ? 'on' : '')); pr.prepend(d); d.style.marginBottom = '10px'; },
    el: ch, prompt: pr,
  };
}
const PLAY_ICON = '<svg width="18" height="18" viewBox="0 0 20 20"><path d="M5 3l12 7-12 7z" fill="currentColor"/></svg>';
const kw = s => `<span style="color:${COL.primary};font-weight:600">${s}</span>`;
const C = { kw: COL.p60, str: COL.p40, txt: COL.code, com: COL.g60 };

/* =====================================================================
   CARD 0 · broke.py · if / else  (PREDICT: 3 quick rounds)
   ===================================================================== */
const CARDS = [];
CARDS[0] = {
  file: 'broke.py', concept: 'if / else',
  init(v) { v.s = { round: 0, right: 0, phase: 'idle', det: true, budget: 1, coins: [], t: 0, flash: 0 }; },
  start(v) { this.round(v); },
  round(v) {
    const s = v.s; s.phase = 'idle'; s.t = 0; s.budget = 1; s.coins = []; v.tr.reset(); v.ui.clear(); v.clearOut();
    if (s.round < 2) {
      s.det = s.round === 0;            // round 1 True, round 2 False
      v.ui.say(`Predict · ${s.round + 1} of 3`, `Netflix checks your account. <code>password_sharing_detected()</code> comes back <b>${s.det ? 'True' : 'False'}</b>. Which line runs?`);
      v.ui.dots(3, s.round);
      const pick = n => this.answer(v, n);
      v.tr.tappable([4, 6], pick);
      v.ui.choice(4, 'raise BrokeError(…)', 'Netflix catches you', () => pick(4));
      v.ui.choice(6, 'print("Still on my…")', 'you get away with it', () => pick(6));
      v.tr.hl(3);
    } else {
      s.phase = 'fork'; s.t = 0;
      v.ui.say('Predict · 3 of 3', `Last one. Can line 4 <b>and</b> line 6 both run in the same go?`); v.ui.dots(3, 2); v.ui.row(true);
      const yes = v.ui.choice(null, 'Yes', 'if the timing is right', () => this.final(v, false, yes, no));
      const no = v.ui.choice(null, 'No', 'never both', () => this.final(v, true, no, yes));
    }
  },
  answer(v, n) {
    const s = v.s, correct = s.det ? 4 : 6, ok = n === correct; v.tr.tappable();
    [...v.ui.el.children].forEach(b => { b.disabled = true; const bn = +b.querySelector('.n').textContent; b.classList.add(bn === correct ? 'right' : bn === n ? 'wrong' : 'wrong'); });
    s.phase = 'run'; s.ok = ok;
    const steps = [{ line: 1, wait: 450 }, { line: 3, wait: 900, chip: [3, s.det ? 'True' : 'False'], sfx: s.det ? 'tru' : 'fal' }];
    if (s.det) steps.push({ line: 4, wait: 300, fn: () => { s.phase = 'caught'; s.t = 0; s.flash = 1; }, sfx: 'err' }, { chip: [4, 'Error'], out: 'BrokeError: Goodbye, food budget.', kind: 'err', wait: 1800 });
    else steps.push({ line: 5, wait: 420 }, { line: 6, wait: 1600, out: 'Still on my friend\'s account.', fn: () => { s.phase = 'friend'; s.t = 0; }, sfx: 'ok' });
    steps.push({ wait: 10, fn: () => this.feedback(v) });
    v.run.run(steps);
    v.ui.say(`Predict · ${s.round + 1} of 3`, 'Running it…');
  },
  feedback(v) {
    const s = v.s; if (s.ok) s.right++;
    const why = s.det ? 'The if is <b>True</b>, so line 4 runs and the else gets skipped.' : 'The if is <b>False</b>, so Python skips line 4 and jumps to the else.';
    v.ui.say(s.ok ? 'Nice' : 'Not quite', why, s.ok ? 'ok' : 'no'); s.ok ? sfx.ok() : sfx.no();
    v.ui.clear(); v.ui.button(`Next ${PLAY_ICON}`, () => { s.round++; this.round(v); });
  },
  final(v, ok, picked, other) {
    picked.classList.add(ok ? 'right' : 'wrong'); other.classList.add(ok ? 'wrong' : 'right'); picked.disabled = other.disabled = true;
    const s = v.s; if (ok) s.right++;
    v.ui.say(ok ? 'Exactly' : 'Nope', '<b>if / else</b> always picks exactly one path. Either line 4 runs or line 6 does. Never both.', ok ? 'ok' : 'no');
    ok ? sfx.ok() : sfx.no();
    v.ui.clear();
    if (s.right >= 2) { award('broke'); v.ui.button('Play again', () => { s.round = 0; s.right = 0; this.round(v); }, 'light'); }
    else v.ui.button('Try again', () => { s.round = 0; s.right = 0; this.round(v); });
  },
  update(v, dt) {
    const s = v.s; s.t += dt / 1000; s.flash = Math.max(0, s.flash - dt / 700);
    if (s.phase === 'caught') {
      s.budget = Math.max(0, 1 - s.t / 1.6);
      if (s.budget > 0 && Math.random() < .5) { s.coins.push({ x: 760 + rand(-20, 60), y: 250, vx: rand(-260, 260), vy: rand(-520, -300), r: rand(0, 6) }); sfx.coin(); }
    }
    for (const k of s.coins) { k.vy += 1500 * dt / 1000; k.x += k.vx * dt / 1000; k.y += k.vy * dt / 1000; k.r += dt / 120; }
    s.coins = s.coins.filter(k => k.y < 700);
  },
  draw(v, c) {
    const s = v.s, T = v.t;
    if (s.phase === 'fork') {                       // round 3: one road in, two doors, only one ever lights up
      const lit = Math.floor(s.t / 1.1) % 2;        // 0 -> line 4, 1 -> line 6
      card(c, 380, 30, 240, 90, 18, COL.ink, COL.accent, 6); txt(c, 'line 3 · if', 500, 88, `600 30px ${F.m}`, COL.light, 'center');
      [[220, 'line 4', 'raise BrokeError', 'True'], [780, 'line 6', 'print(…)', 'False']].forEach(([x, l, sub, cond], i) => {
        const on = lit === i; c.lineWidth = 14; c.lineCap = 'round'; c.strokeStyle = on ? COL.primary : COL.g35;
        c.beginPath(); c.moveTo(500, 130); c.bezierCurveTo(500, 230, x, 210, x, 300); c.stroke();
        txt(c, cond, (500 + x) / 2 + (i ? 120 : -120), 215, `600 28px ${F.m}`, on ? COL.primary : COL.g60, 'center');
        card(c, x - 160, 310, 320, 150, 20, on ? COL.primary : COL.light, on ? COL.ink : COL.accent, 7);
        txt(c, l, x, 375, `700 46px ${F.d}`, on ? COL.light : COL.ink, 'center'); txt(c, sub, x, 420, `400 26px ${F.m}`, on ? COL.sky : COL.g75, 'center');
      });
      txt(c, 'only one door opens', 500, 520, `400 28px ${F.b}`, COL.g75, 'center');
      return;
    }
    // TV
    const caught = s.phase === 'caught', friend = s.phase === 'friend';
    card(c, 40, 40, 540, 360, 22, COL.furniture, COL.accent);
    fillRR(c, 62, 62, 496, 316, 10, COL.ink);
    c.fillStyle = COL.furniture; c.fillRect(280, 400, 60, 40); fillRR(c, 210, 436, 200, 18, 9, COL.furniture);
    if (caught) {
      const on = s.t > .9 || Math.floor(s.t * 8) % 2 === 0;
      if (on) { c.fillStyle = COL.primary; c.fillRect(62, 150, 496, 140); }
      circle(c, 124, 220, 36, COL.light); txt(c, '!', 124, 238, `700 52px ${F.d}`, COL.primary, 'center');
      txt(c, 'SHARING', 178, 212, `700 50px ${F.d}`, COL.light); txt(c, 'DETECTED', 178, 258, `700 50px ${F.d}`, COL.light);
    } else if (friend) {
      txt(c, 'Who’s watching?', 310, 128, `700 34px ${F.b}`, COL.light, 'center');
      const names = ['friend', 'friend’s mum', 'kids'], cols = [COL.primary, COL.accent, COL.edge];
      names.forEach((n, i) => {
        const pop = back(clamp(s.t * 3 - i * .25, 0, 1)), x = 110 + i * 140, y = 170, w = 110 * pop;
        if (pop <= 0) return;
        c.save(); c.translate(x + 55, y + 55); c.scale(pop, pop); c.translate(-(x + 55), -(y + 55));
        fillRR(c, x, y, 110, 110, 16, cols[i]); circle(c, x + 38, y + 46, 7, COL.light); circle(c, x + 72, y + 46, 7, COL.light);
        c.beginPath(); c.arc(x + 55, y + 62, 22, .15 * Math.PI, .85 * Math.PI); c.strokeStyle = COL.light; c.lineWidth = 6; c.stroke();
        if (i === 0) strokeRR(c, x - 8, y - 8, 126, 126, 20, COL.light, 5 + 2 * Math.sin(T * 6));
        c.restore(); txt(c, n, x + 55, y + 150, `400 22px ${F.b}`, COL.soft, 'center');
      });
    } else {
      c.beginPath(); c.moveTo(286, 170); c.lineTo(356, 220); c.lineTo(286, 270); c.closePath(); c.fillStyle = COL.edge; c.fill();
      txt(c, s.phase === 'run' ? 'checking…' : 'paused', 310, 330, `400 22px ${F.m}`, COL.g60, 'center');
    }
    // wallet + budget
    const open = caught;
    card(c, 650, 190, 290, 190, 26, COL.accent, COL.ink, 6);
    fillRR(c, 650, open ? 150 : 190, 290, 74, 26, COL.primary); strokeRR(c, 650, open ? 150 : 190, 290, 74, 26, COL.ink, 4);
    if (!open || s.budget > .4) for (let k = 0; k < 4; k++) { circle(c, 715 + k * 52, open ? 150 - (k % 2) * 10 : 194, 22, COL.light); ring(c, 715 + k * 52, open ? 150 - (k % 2) * 10 : 194, 22, COL.ink, 3.5); }
    fillRR(c, 880, 266, 60, 48, 14, COL.p40); circle(c, 910, 290, 10, COL.accent);
    for (const k of s.coins) { c.save(); c.translate(k.x, k.y); c.scale(Math.cos(k.r), 1); circle(c, 0, 0, 20, COL.light); ring(c, 0, 0, 20, COL.accent, 4); c.restore(); }
    txt(c, 'FOOD BUDGET', 650, 438, `600 22px ${F.m}`, COL.g75);
    const money = (84.2 * (open ? s.budget : 1)).toFixed(2);
    txt(c, '$' + money, 940, 438, `700 30px ${F.d}`, open && s.budget < .05 ? COL.primary : COL.ink, 'right');
    fillRR(c, 650, 456, 290, 26, 13, COL.g12);
    if (!open || s.budget > 0) fillRR(c, 650, 456, Math.max(26, 290 * (open ? s.budget : 1)), 26, 13, COL.primary);
    if (friend) { const k = back(clamp(s.t * 2.2 - .6, 0, 1)); if (k > 0) { c.globalAlpha = clamp(k, 0, 1); fillRR(c, 600, 508 - 20 * k, 380, 44, 22, COL.ink); txt(c, 'Still on my friend’s account.', 790, 538 - 20 * k, `600 20px ${F.m}`, COL.light, 'center'); c.globalAlpha = 1; } }
    if (s.flash > 0) { c.fillStyle = `rgba(30,85,255,${s.flash * .3})`; c.fillRect(-500, -500, 2000, 1600); }
  },
};

/* =====================================================================
   CARD 1 · procrastination.py · while loop  (FIX: where does break go?)
   ===================================================================== */
CARDS[1] = {
  file: 'procrastination.py', concept: 'while loop',
  OPTIONS: [
    { id: 'A', after: 5, indent: 8, label: 'After study()', sub: 'between line 5 and 6' },
    { id: 'B', after: 8, indent: 8, label: 'After time.sleep(30)', sub: 'at the end of the except' },
    { id: 'C', after: 2, indent: 0, label: 'Before while True', sub: 'on line 2, above the loop' },
  ],
  init(v) { v.s = { phase: 'idle', checks: 0, t: 0, lift: 0, liftT: 0, err: 0, notes: [], speed: 1, choice: null, tried: new Set(), end: 0, glitch: 0 }; },
  start(v) { this.intro(v); },
  intro(v) {
    const s = v.s; v.tr.reset(); v.ui.clear(); s.phase = 'idle'; s.checks = 0; s.notes = []; s.choice = null; s.end = 0; v.tr.hl(3);
    v.ui.say('Step 1 · Run it', `<code>while True</code> means “keep going forever”. Run it and see if it ever stops.`);
    v.ui.button(`${PLAY_ICON} Run`, () => this.runLoop(v));
  },
  iteration(v, choice) {
    const s = v.s, sp = () => Math.max(.28, 1 / s.speed);
    const steps = [
      { line: 3, wait: 380 * sp(), chip: [3, 'True'], sfx: 'tru' },
      { line: 4, wait: 260 * sp() },
      { line: 5, wait: 520 * sp(), fn: () => { s.studyT = 1; } },
    ];
    if (choice === 'A') steps.push({ wait: 450, fn: () => v.tr.insert(5, 'break', 8, 'skip') });
    steps.push(
      { line: 6, wait: 460 * sp(), chip: [5, 'Error'], fn: () => { s.err = 1; }, sfx: 'fal' },
      { line: 7, wait: 700 * sp(), fn: () => { s.checks++; s.lift = 1; s.liftT = 0; this.note(v); v.out(`Phone check no. ${46 + s.checks}`); }, sfx: 'ping' },
      { line: 8, wait: 520 * sp(), fn: () => { s.lift = 0; } });
    if (choice === 'B') steps.push({ wait: 650, fn: () => { v.tr.insert(8, 'break', 8); v.tr.hl(null); } }, { wait: 10, fn: () => this.ended(v) });
    else steps.push({ wait: 10, fn: () => { v.tr.chip(5, null); s.speed *= 1.25; this.afterLap(v, choice); } });
    return steps;
  },
  runLoop(v, choice) {
    const s = v.s; v.tr.clearChips(); v.clearOut(); s.speed = 1; s.checks = 0; s.notes = []; s.phase = 'loop'; s.end = 0;
    v.ui.clear();
    if (choice === 'C') {                   // break outside the loop: Python refuses to even start
      v.tr.insert(2, 'break', 0, 'bad');
      v.ui.say('Running…', '');
      v.run.run([{ line: 2, wait: 500 }, { chip: [2, 'SyntaxError'], out: "SyntaxError: 'break' outside loop", kind: 'err', sfx: 'err', fn: () => { s.phase = 'syntax'; s.t = 0; s.glitch = 1; }, wait: 900 }, { wait: 10, fn: () => this.verdict(v, 'C') }]);
      return;
    }
    if (choice) v.tr.insert(choice === 'A' ? 5 : 8, 'break', 8);
    v.ui.say(choice ? 'Running your fix…' : 'Step 1 · Run it', choice ? 'Watch the break.' : 'Watch the phone checks…');
    v.run.run([{ line: 1, wait: 400 }, ...this.iteration(v, choice)]);
  },
  afterLap(v, choice) {
    const s = v.s;
    if (choice === 'A' && s.checks >= 2) { this.verdict(v, 'A'); return; }
    if (!choice && s.checks === 3) this.askFix(v);
    v.run.push(...this.iteration(v, choice));
  },
  askFix(v) {
    v.ui.say('Step 2 · Fix it', `It’s never going to stop. Add a <code>break</code> to get out of the loop. Where should it go?`);
    v.ui.clear();
    this.OPTIONS.forEach(o => { const b = v.ui.choice(o.id, o.label, o.sub, () => this.pick(v, o)); if (v.s.tried.has(o.id)) b.classList.add('wrong'); });
  },
  pick(v, o) { const s = v.s; s.choice = o.id; s.tried.add(o.id); v.run.clear(); v.tr.hl(null); v.tr.clearChips(); s.lift = 0; this.runLoop(v, o.id); },
  verdict(v, id) {
    const s = v.s; v.run.clear(); v.ui.clear();
    if (id === 'A') v.ui.say('Still looping', '<code>study()</code> crashes first, so Python jumps straight to <b>except</b>. It never reaches your break.', 'no');
    if (id === 'C') v.ui.say('Python won’t even start', '<b>SyntaxError:</b> break only works inside a loop. Out here it means nothing.', 'no');
    sfx.no();
    v.ui.button('Try another spot', () => { s.phase = 'loop'; s.glitch = 0; v.tr.reset(); this.askFix(v); });
  },
  ended(v) {
    const s = v.s; s.phase = 'ended'; s.t = 0; s.end = 1; v.run.clear(); v.tr.hl(null); v.out('loop ended after 1 phone check', 'ok');
    v.ui.say('Loop ended', 'The break runs at the end of the except, so it jumps out after <b>one</b> phone check. Progress.', 'ok');
    award('procrastination');
    v.ui.clear(); v.ui.button('Run it again', () => { s.tried.clear(); this.intro(v); }, 'light');
  },
  note(v) { const s = v.s; s.notes.push({ y: -80, t: 0, x: rand(560, 640), app: ['messages', 'tiktok', 'instagram', 'group chat'][s.checks % 4], n: rand(2, 99) | 0 }); if (s.notes.length > 4) s.notes.shift(); },
  update(v, dt) {
    const s = v.s, k = dt / 1000; s.t += k; s.err = Math.max(0, s.err - k * 1.2); s.liftT += k; s.glitch = Math.max(0, s.glitch - k * .6);
    s.notes.forEach((n, i) => { n.t += k; const target = 230 + (s.notes.length - 1 - i) * 58; n.y = lerp(n.y, target, Math.min(1, k * 10)); });
  },
  draw(v, c) {
    const s = v.s, T = v.t, ended = s.phase === 'ended';
    // window + desk
    card(c, 40, 40, 230, 190, 14, COL.sky, COL.accent, 6); c.fillStyle = COL.light; c.fillRect(150, 42, 8, 186); c.fillRect(42, 130, 226, 8);
    fillRR(c, 40, 420, 920, 30, 10, COL.furniture); c.fillStyle = COL.furniture; c.fillRect(90, 450, 26, 110); c.fillRect(880, 450, 26, 110);
    const look = s.lift > 0 ? 1 : 0;
    person(c, 380, 310, 1, { look, mood: ended ? 'happy' : s.err > .3 ? 'sad' : 'ok' });
    // book
    c.save(); c.translate(380, 410);
    for (const sx of [-1, 1]) { fillRR(c, sx < 0 ? -190 : 6, -38, 184, 48, 8, ended ? COL.sky : COL.light); strokeRR(c, sx < 0 ? -190 : 6, -38, 184, 48, 8, COL.ink, 3.5); for (let k = 0; k < 3; k++) fillRR(c, (sx < 0 ? -172 : 24), -28 + k * 12, 128 - k * 22, 5, 2, ended ? COL.p60 : COL.g35); }
    c.restore();
    // phone
    let px = 600, py = 392, rot = 0;
    if (s.lift > 0) { const k = easeOut(Math.min(1, s.liftT / .25)); px = lerp(600, 470, k); py = lerp(392, 250, k); rot = lerp(0, -.25, k); }
    if (ended) { const k = ease(Math.min(1, s.t / .7)); px = lerp(600, 1100, k); }
    c.save(); c.translate(px, py); c.rotate(rot); fillRR(c, -30, -52, 60, 104, 12, COL.ink); fillRR(c, -23, -43, 46, 80, 5, s.lift ? COL.primary : COL.furniture); c.restore();
    if (s.err > 0) { c.globalAlpha = Math.min(1, s.err * 2); fillRR(c, 170, 60, 420, 50, 25, COL.ink); txt(c, 'MotivationNotFoundError', 380, 94, `600 21px ${F.m}`, COL.light, 'center'); c.globalAlpha = 1; }
    // notifications pile on the right
    if (!ended) s.notes.forEach(n => { const x = 680, w = 280; card(c, x, n.y, w, 48, 14, COL.light, COL.primary, 4); circle(c, x + 26, n.y + 24, 13, COL.primary); txt(c, n.app, x + 48, n.y + 31, `700 19px ${F.b}`, COL.ink); txt(c, String(n.n), x + w - 16, n.y + 31, `600 18px ${F.m}`, COL.primary, 'right'); });
    // counter
    txt(c, 'PHONE CHECKS', 960, 54, `600 20px ${F.m}`, COL.g75, 'right');
    const bump = s.lift > 0 ? 1 + .15 * Math.max(0, 1 - s.liftT * 4) : 1;
    c.save(); c.translate(960, 150); c.scale(bump, bump); txt(c, String(s.checks), 0, 0, `700 110px ${F.d}`, s.checks ? COL.primary : COL.g35, 'right'); c.restore();
    if (ended) { const k = back(clamp(s.t * 2, 0, 1)); c.save(); c.translate(820, 300); c.scale(k, k); card(c, -150, -38, 300, 76, 38, COL.primary, COL.ink, 5); txt(c, 'LOOP ENDED', 0, 14, `700 38px ${F.d}`, COL.light, 'center'); c.restore(); }
    if (s.phase === 'syntax') {
      if (s.glitch > 0) for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? COL.primary : COL.ink; c.globalAlpha = .25 * s.glitch; c.fillRect(0, rand(0, 560), 1000, rand(6, 30)); } c.globalAlpha = 1;
      card(c, 220, 200, 560, 140, 20, COL.ink, COL.primary, 8);
      txt(c, 'SyntaxError', 500, 262, `700 48px ${F.d}`, COL.light, 'center'); txt(c, '’break’ outside loop', 500, 306, `400 24px ${F.m}`, COL.p40, 'center');
    }
  },
};

/* =====================================================================
   CARD 2 · deadline.py · if / elif  (EXPLORE the week, then FIX line 4)
   ===================================================================== */
CARDS[2] = {
  file: 'deadline.py', concept: 'if / elif',
  CONDS: [
    { id: 'eq1', code: 'days_left == 1', test: d => d === 1 },
    { id: 'le3', code: 'days_left <= 3', test: d => d <= 3 },
    { id: 'gt3', code: 'days_left > 3', test: d => d > 3 },
    { id: 'eq0', code: 'days_left == 0', test: d => d === 0 },
  ],
  init(v) { v.s = { phase: 'idle', day: 7, week: {}, cond: 'eq1', t: 0, shake: 0, cans: [], playing: false, tried: new Set() }; },
  start(v) { this.intro(v); },
  intro(v) {
    const s = v.s; v.tr.reset(); v.ui.clear(); s.week = {}; s.cond = 'eq1'; s.day = 7; s.phase = 'idle';
    v.ui.say('Step 1 · Play the week', 'What does this code do each day before the deadline? Play the whole week, from 7 days left down to 1.');
    v.ui.button(`${PLAY_ICON} Play the week`, () => this.playWeek(v));
  },
  outcome(d, condId) { if (d === 7) return 'chill'; return this.CONDS.find(c => c.id === condId).test(d) ? 'panic' : 'none'; },
  playWeek(v) {
    const s = v.s, cond = this.CONDS.find(c => c.id === s.cond); s.week = {}; s.playing = true; v.ui.clear(); v.tr.clearChips(); v.clearOut();
    v.ui.say(s.cond === 'eq1' ? 'Step 1 · Play the week' : 'Testing your fix', 'Playing…');
    const steps = [];
    for (let d = 7; d >= 1; d--) {
      const o = this.outcome(d, s.cond), fast = 1;
      steps.push({ wait: 120, fn: () => { s.day = d; s.phase = 'day'; s.t = 0; s.cans = []; v.tr.clearChips(); } });
      steps.push({ line: 1, wait: 420 * fast, chip: [1, d === 7 ? 'True' : 'False'], sfx: d === 7 ? 'tru' : 'fal' });
      if (d === 7) steps.push({ line: 2, wait: 330, out: 'Plenty of time.' }, { line: 3, wait: 420, out: "I'll start tomorrow." });
      else { steps.push({ line: 4, wait: 420, chip: [4, cond.test(d) ? 'True' : 'False'], sfx: cond.test(d) ? 'tru' : 'fal' });
        if (o === 'panic') steps.push({ line: 5, wait: 200 }, { line: 6, wait: 200, fn: () => { s.shake = 1; } }, { line: 7, wait: 500, sfx: 'err', out: `day ${d}: pull_all_nighter()`, kind: 'err' });
        else steps.push({ line: null, wait: 500, out: `day ${d}: nothing runs`, kind: 'sys' }); }
      steps.push({ wait: 150, fn: () => { s.week[d] = o; } });
    }
    steps.push({ wait: 300, fn: () => { s.playing = false; v.tr.hl(null); v.tr.clearChips(); this.afterWeek(v); } });
    v.run.run(steps);
  },
  afterWeek(v) {
    const s = v.s; v.ui.clear();
    if (s.cond === 'eq1') {
      v.ui.say('Step 2 · Fix line 4', 'Days 6 to 2: <b>nothing runs at all</b>. You only panic on the last day. Pick a new condition for <code>elif</code> on line 4 so you start earlier.');
      v.ui.grid(true); this.CONDS.forEach(c => { const b = v.ui.choice(null, c.code, c.id === 'eq1' ? 'on the card now' : 'try this', () => this.pick(v, c)); if (c.id === 'eq1') b.classList.add('current'); if (s.tried.has(c.id)) b.classList.add('wrong'); });
      return;
    }
    const msg = {
      le3: ['Fixed', 'Now the panic starts with <b>3 days left</b>. Still a crisis, just a smaller one.', 'ok'],
      gt3: ['Hmm', 'You panic with 6, 5 and 4 days left, then do <b>nothing</b> right before the deadline. Relatable, but no.', 'no'],
      eq0: ['Deadline missed', '<code>days_left</code> never hits 0 in this week, so the panic never runs. You never start.', 'no'],
    }[s.cond];
    v.ui.say(...msg); msg[2] === 'ok' ? sfx.ok() : sfx.no();
    if (s.cond === 'le3') { award('deadline'); v.ui.button('Start over', () => { s.tried.clear(); this.intro(v); }, 'light'); }
    else v.ui.button('Try another fix', () => { s.cond = 'eq1'; v.tr.patch(4, null); this.afterWeek(v); });
  },
  pick(v, c) {
    const s = v.s; s.cond = c.id; s.tried.add(c.id);
    const [a, op, b] = c.code.split(' ');
    v.tr.patch(4, [['elif', C.kw], [' ' + a + ' ', C.txt], [op, C.txt], [' ', C.txt], [b, C.str], [':', C.txt]], true); sfx.key();
    setTimeout(() => this.playWeek(v), 500);
  },
  update(v, dt) {
    const s = v.s, k = dt / 1000; s.t += k; s.shake = Math.max(0, s.shake - k * .9);
    if (s.phase === 'day' && s.week[s.day] === undefined && this.outcome(s.day, s.cond) === 'panic' && s.shake > 0) {
      s.canT = (s.canT || 0) + k; if (s.cans.length < 5 && s.canT > .12) { s.canT = 0; s.cans.push({ x: rand(720, 900), y: -40, vy: 0, land: 0 }); }
    }
    for (const c of s.cans) if (!c.land) { c.vy += 2200 * k; c.y += c.vy * k; if (c.y >= 330) { c.y = 330; c.land = 1; blip(500, .04, 'square', .015); } }
  },
  draw(v, c) {
    const s = v.s, d = s.day, cur = s.phase === 'day' ? (s.week[d] || (s.playing ? this.outcome(d, s.cond) : null)) : null;
    c.save(); if (s.shake > 0) c.translate(rand(-1, 1) * 10 * s.shake, rand(-1, 1) * 8 * s.shake);
    // calendar
    card(c, 40, 34, 220, 290, 18, COL.light, d === 1 ? COL.primary : COL.accent, 6);
    c.save(); rr(c, 40, 34, 220, 290, 18); c.clip(); c.fillStyle = cur === 'panic' ? COL.primary : COL.ink; c.fillRect(40, 34, 220, 62); c.restore();
    strokeRR(c, 40, 34, 220, 290, 18, COL.ink, 4);
    txt(c, 'DAYS LEFT', 150, 76, `600 22px ${F.m}`, COL.light, 'center');
    txt(c, String(d), 150, 292, `700 190px ${F.d}`, cur === 'panic' ? COL.primary : COL.ink, 'center');
    // the moment
    const sx = 300;
    if (cur === 'panic') {
      fillRR(c, sx + 40, 270, 600, 22, 8, COL.furniture); person(c, sx + 230, 180, .9, { mood: 'panic' });
      card(c, sx + 330, 170, 200, 110, 12, COL.ink, COL.accent, 5); for (let k = 0; k < 4; k++) fillRR(c, sx + 350, 190 + k * 20, 40 + ((k * 37 + Math.floor(v.t * 10) * 13) % 120), 8, 4, k % 2 ? COL.p60 : COL.code);
      for (const cn of s.cans) { fillRR(c, cn.x - 14, cn.y - 50, 28, 56, 6, COL.accent); bolt(c, cn.x, cn.y - 24, 1.2, COL.light); }
      txt(c, 'ALL-NIGHTER', 960, 74, `700 44px ${F.d}`, COL.primary, 'right');
    } else if (cur === 'chill' || cur === 'none') {
      fillRR(c, sx + 60, 200, 560, 90, 26, COL.edge); fillRR(c, sx + 40, 250, 600, 70, 22, COL.furniture);
      fillRR(c, sx + 190, 214, 250, 50, 24, COL.primary); person(c, sx + 150, 232, .7, { mood: cur === 'none' ? 'sleep' : 'happy' });
      if (cur === 'chill') { const say = s.t > .9 ? 'I’ll start tomorrow.' : 'Plenty of time.'; card(c, sx + 230, 70, 380, 70, 22, COL.light, COL.primary, 5); txt(c, say, sx + 252, 116, `700 30px ${F.b}`, COL.ink); }
      else for (let k = 0; k < 3; k++) { const p = (v.t * .6 + k / 3) % 1; c.globalAlpha = 1 - p; txt(c, 'z', sx + 190 + p * 90, 170 - p * 110, `700 ${34 + k * 10}px ${F.d}`, COL.g60); c.globalAlpha = 1; }
      if (cur === 'none') txt(c, 'nothing runs', 960, 74, `600 26px ${F.m}`, COL.g75, 'right');
    } else {
      txt(c, 'Tap Play the week', sx + 330, 190, `400 28px ${F.b}`, COL.g60, 'center');
    }
    c.restore();
    // week strip
    const y0 = 380; txt(c, 'THE WEEK', 40, y0 - 14, `600 20px ${F.m}`, COL.g75);
    for (let i = 0; i < 7; i++) {
      const day = 7 - i, x = 40 + i * 132, o = s.week[day], isCur = s.playing && day === d;
      const fill = o === 'panic' ? COL.primary : o === 'chill' ? COL.sky : o === 'none' ? COL.g12 : COL.light;
      card(c, x, y0, 116, 150, 14, fill, isCur ? COL.ink : COL.accent, isCur ? 7 : 4);
      txt(c, String(day), x + 58, y0 + 48, `700 40px ${F.d}`, o === 'panic' ? COL.light : COL.ink, 'center');
      if (o === 'panic') bolt(c, x + 58, y0 + 100, 2.2, COL.light);
      else if (o === 'chill') { fillRR(c, x + 24, y0 + 92, 68, 22, 8, COL.primary); fillRR(c, x + 18, y0 + 104, 80, 18, 8, COL.accent); }
      else if (o === 'none') txt(c, '–', x + 58, y0 + 118, `700 44px ${F.d}`, COL.g60, 'center');
      txt(c, o === 'panic' ? 'panic' : o === 'chill' ? 'chill' : o === 'none' ? 'zzz' : '', x + 58, y0 + 140, `600 15px ${F.m}`, o === 'panic' ? COL.sky : COL.g75, 'center');
    }
  },
};

/* =====================================================================
   CARD 3 · lecture.py · try / except  (ARCADE: hold + swat notifications)
   ===================================================================== */
CARDS[3] = {
  file: 'lecture.py', concept: 'try / except',
  init(v) {
    let best = 0; try { best = +localStorage.getItem('l5ar-lecture-best') || 0; } catch (e) {}
    v.s = { phase: 'idle', att: 1, sec: 0, t: 0, phoneT: 0, best, notes: [], nextNote: 1, pops: [] };
  },
  start(v) { this.intro(v); },
  intro(v) {
    const s = v.s; v.tr.reset(); v.ui.clear(); v.clearOut(); Object.assign(s, { phase: 'idle', att: 1, sec: 0, t: 0, notes: [], pops: [] });
    v.tr.hl(4);
    v.ui.say('Survive the lecture', `Hold the button to listen. Notifications drain your attention, so <b>tap them away</b> with your other thumb. Last 5:00 and the except never runs.${s.best ? ` Your best: <b>${fmt(s.best)}</b>.` : ''}`);
    const b = v.ui.button('<span>Hold to listen</span>', () => {}, 'hold'); const fill = h('i', 'fill'); b.prepend(fill); v.holdBtn = b; v.holdFill = fill;
    const down = e => { e.preventDefault(); audioInit(); b.classList.add('down'); this.listen(v); };
    const up = () => { if (!b.classList.contains('down')) return; b.classList.remove('down'); if (s.phase === 'listen') this.zoneOut(v, 'You let go.'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  },
  listen(v) {
    const s = v.s; if (s.phase !== 'idle') return;
    v.tr.clearChips(); v.run.clear(); v.tr.hl(4); sfx.step();
    Object.assign(s, { phase: 'listen', att: 1, sec: 0, t: 0, notes: [], nextNote: .9 });
    v.ui.say('try:', 'Line 4 is running. Keep holding. Tap the notifications.');
  },
  onStageTap(v, x, y) {
    const s = v.s; if (s.phase !== 'listen') return;
    for (let i = s.notes.length - 1; i >= 0; i--) { const n = s.notes[i]; if (x > n.x - 24 && x < n.x + n.w + 24 && y > n.y - 24 && y < n.y + 108) { s.notes.splice(i, 1); s.att = Math.min(1, s.att + .04); s.pops.push({ x: n.x + n.w / 2, y: n.y + 42, t: 0 }); sfx.tap(); buzz(10); return; } }
  },
  zoneOut(v, why) {
    const s = v.s; s.phase = 'except'; s.t = 0;
    const lasted = s.sec; if (lasted > s.best) { s.best = lasted; try { localStorage.setItem('l5ar-lecture-best', String(Math.round(lasted))); } catch (e) {} }
    v.ui.say('except:', `${why} Line 4 raised <b>AttentionSpanError</b>, so Python jumps to the except.`, 'no');
    if (v.holdBtn) v.holdBtn.disabled = true;
    v.run.run([
      { chip: [4, 'Error'], out: 'AttentionSpanError', kind: 'err', wait: 650, sfx: 'err' },
      { line: 5, wait: 600 }, { line: 6, wait: 500, fn: () => { s.phoneT = 0; s.phase = 'phone'; } },
      { line: 7, wait: 1300, out: 'phone.open("instagram", "tiktok")' },
      { wait: 10, fn: () => { v.ui.clear(); v.ui.say('You lasted ' + fmt(lasted), lasted >= 200 ? 'So close. The notifications come faster the longer you last.' : 'Tip: hold with one thumb, tap with the other.', 'no'); v.ui.button('Try again', () => this.intro(v)); } },
    ]);
  },
  win(v) {
    const s = v.s; s.phase = 'win'; s.t = 0; s.best = 300; try { localStorage.setItem('l5ar-lecture-best', '300'); } catch (e) {}
    v.tr.hl(null); v.tr.dimLines([5, 6, 7]); if (v.holdBtn) v.holdBtn.disabled = true; v.out('lecture finished, no exception', 'ok');
    v.ui.say('No exception', 'Line 4 finished without an error, so the <b>except</b> block (lines 5–7) never runs.', 'ok');
    award('lecture');
    setTimeout(() => { v.ui.clear(); v.ui.button('Play again', () => this.intro(v), 'light'); }, 900);
  },
  update(v, dt) {
    const s = v.s, k = dt / 1000; s.t += k; s.phoneT += k;
    s.pops.forEach(p => p.t += k); s.pops = s.pops.filter(p => p.t < .4);
    if (s.phase === 'listen') {
      s.sec += k * 20;                                       // 1 real second = 20 lecture seconds -> 15 s to win
      s.att -= k * (.02 + .13 * s.notes.length);
      s.nextNote -= k;
      if (s.nextNote <= 0) {
        const apps = ['group chat', 'tiktok', 'instagram', 'messages', 'youtube', 'game invite'];
        let x, y, tries = 0;
        do { x = rand(30, 420); y = rand(140, 450); tries++; } while (tries < 15 && s.notes.some(n => Math.abs(n.x - x) < 370 && Math.abs(n.y - y) < 96));
        s.notes.push({ x, y, w: 360, app: apps[(Math.random() * apps.length) | 0], t: 0 });
        s.nextNote = Math.max(.35, 1.1 - s.sec / 400) + rand(0, .5); sfx.ping(); buzz(25);
      }
      s.notes.forEach(n => n.t += k);
      if (v.holdFill) v.holdFill.style.width = (s.sec / 300 * 100) + '%';
      if (s.sec >= 300) { s.sec = 300; this.win(v); }
      else if (s.att <= 0) { s.att = 0; this.zoneOut(v, 'You zoned out.'); }
    }
  },
  draw(v, c) {
    const s = v.s;
    // whiteboard + professor
    card(c, 30, 40, 500, 330, 14, COL.light, COL.accent, 6);
    txt(c, 'Lecture 7', 56, 92, `700 34px ${F.d}`, COL.ink); txt(c, 'Cloud computing', 56, 124, `400 22px ${F.b}`, COL.g75);
    const prog = Math.min(1, s.sec / 300);
    for (let k = 0; k < 6; k++) { const w = [380, 300, 420, 260, 360, 320][k] * clamp(prog * 6 - k, 0, 1); if (w > 0) fillRR(c, 56, 160 + k * 30, w, 10, 5, k % 3 ? COL.g35 : COL.p40); }
    const wave = s.phase === 'listen' ? Math.sin(s.t * 6) * .3 : 0;
    c.save(); c.translate(600, 300); c.rotate(-2.3 + wave); c.lineWidth = 16; c.lineCap = 'round'; c.strokeStyle = COL.furniture; c.beginPath(); c.moveTo(0, 0); c.lineTo(80, 0); c.stroke(); c.restore();
    person(c, 640, 290, .85, { body: COL.furniture, mood: 'ok' });
    // timer + attention
    txt(c, fmt(s.sec), 970, 96, `700 64px ${F.d}`, s.phase === 'win' ? COL.primary : COL.ink, 'right');
    txt(c, 'OF 5:00', 970, 124, `600 18px ${F.m}`, COL.g75, 'right');
    txt(c, 'ATTENTION', 780, 450, `600 20px ${F.m}`, COL.g75);
    fillRR(c, 780, 464, 190, 30, 15, COL.g12);
    if (s.att > 0) fillRR(c, 780, 464, Math.max(30, 190 * s.att), 30, 15, s.att < .3 ? COL.ink : COL.primary);
    strokeRR(c, 780, 464, 190, 30, 15, COL.ink, 3);
    // notifications (tap targets)
    if (s.phase === 'listen') s.notes.forEach(n => {
      const k = back(clamp(n.t * 4, 0, 1)), wob = Math.sin(n.t * 18) * Math.max(0, .6 - n.t) * 3;
      c.save(); c.translate(n.x + n.w / 2 + wob, n.y + 42); c.scale(k, k); c.translate(-n.w / 2, -42);
      card(c, 0, 0, n.w, 84, 22, COL.light, COL.primary, 6); circle(c, 42, 42, 22, COL.primary); txt(c, n.app, 80, 52, `700 32px ${F.b}`, COL.ink);
      txt(c, '×', n.w - 34, 54, `700 40px ${F.b}`, COL.g60, 'center'); c.restore();
    });
    s.pops.forEach(p => { c.globalAlpha = 1 - p.t / .4; ring(c, p.x, p.y, 30 + p.t * 120, COL.primary, 6); c.globalAlpha = 1; });
    // phone takes over on except
    if (s.phase === 'phone' || (s.phase === 'except' && s.phoneT < 5 && s.phoneT > 0 && false)) {}
    if (s.phase === 'phone') {
      const k = easeOut(Math.min(1, s.phoneT / .45)), y = lerp(620, 70, k);
      c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 30; fillRR(c, 340, y, 300, 440, 38, COL.ink); c.restore();
      fillRR(c, 358, y + 18, 264, 404, 26, COL.wall);
      [['instagram', COL.primary], ['tiktok', COL.accent]].forEach(([n, col], i) => {
        const x = 386 + i * 124, yy = y + 54, pop = back(clamp(s.phoneT * 3 - .5 - i * .2, 0, 1));
        c.save(); c.translate(x + 48, yy + 48); c.scale(pop, pop); c.translate(-(x + 48), -(yy + 48));
        fillRR(c, x, yy, 96, 96, 24, col);
        if (i === 0) { strokeRR(c, x + 22, yy + 22, 52, 52, 16, COL.light, 7); ring(c, x + 48, yy + 48, 12, COL.light, 7); circle(c, x + 64, yy + 32, 4.5, COL.light); }
        else { c.fillStyle = COL.light; c.fillRect(x + 50, yy + 22, 9, 42); circle(c, x + 44, yy + 66, 13, COL.light); c.fillRect(x + 50, yy + 22, 20, 9); }
        c.restore(); txt(c, n, x + 48, yy + 124, `400 20px ${F.b}`, COL.soft, 'center');
      });
      txt(c, 'phone.open(…)', 490, y + 300, `600 22px ${F.m}`, COL.p40, 'center');
    }
    if (s.phase === 'win') { const k = back(clamp(s.t * 2, 0, 1)); c.save(); c.translate(500, 250); c.scale(k, k); card(c, -220, -50, 440, 100, 50, COL.primary, COL.ink, 6); txt(c, 'MADE IT', 0, 18, `700 54px ${F.d}`, COL.light, 'center'); c.restore(); }
  },
};
function fmt(sec) { sec = Math.round(sec); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

/* =====================================================================
   GEARS: x-ray sandbox + challenge help
   ===================================================================== */
const G = ART.gears;                      // id -> {x, y, teeth, dia}
const LABEL = { A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', J: 'H', H: 'handle', OL: 'left output', OR: 'right output' };
const FIXED = ['H', 'OL', 'OR'];
function gearSpin(ins) {                  // -> {dir: {id: ±1}, jam: [ids in an odd loop] | null}
  const on = new Set([...ins, ...FIXED]), adj = {}; on.forEach(g => adj[g] = []);
  ART.mesh.forEach(([a, b]) => { if (on.has(a) && on.has(b)) { adj[a].push(b); adj[b].push(a); } });
  const dir = { H: 1 }, par = { H: null }, q = ['H'];
  while (q.length) {
    const g = q.shift();
    for (const n of adj[g]) {
      if (!(n in dir)) { dir[n] = -dir[g]; par[n] = g; q.push(n); }
      else if (dir[n] === dir[g]) {          // odd loop: walk both back to the common ancestor
        const up = x => { const p = []; while (x) { p.push(x); x = par[x]; } return p; };
        const a = up(g), b = up(n), common = a.find(x => b.includes(x));
        return { dir: null, jam: [...a.slice(0, a.indexOf(common) + 1), ...b.slice(0, b.indexOf(common)).reverse()] };
      }
    }
  }
  return { dir, jam: null };
}
const CHAL = ART.challenges;
const NUDGE = {
  '01': 'Every gear flips the spin. The handle turns clockwise, so with <b>one</b> gear in between, the output turns clockwise too.',
  '02': 'Leave the left side as it is. Find a path from the handle across to the right output.',
  '03': 'Anticlockwise means an <b>even</b> number of gears between the handle and the output. And watch out: three gears that all touch each other will jam.',
  '04': 'There’s more than one way to reach the right output. Try going along the bottom.',
  '05': 'F has to touch the handle. But F, G and the handle all touch each other, so they can’t all be in at once.',
  '06': 'You’ve built each half before. Which earlier challenges spun the same way?',
};
function goalOK(ins, goal) {
  const r = gearSpin(ins); if (!r.dir) return false;
  return Object.entries(goal).every(([g, d]) => (g in r.dir) && (!d || r.dir[g] === d));
}
const ARROW = (cw, col = 'currentColor') => `<svg width="18" height="18" viewBox="0 0 20 20" style="transform:scaleX(${cw ? 1 : -1})"><path d="M15.5 10a5.5 5.5 0 1 1-2-4.25" fill="none" stroke="${col}" stroke-width="2.6" stroke-linecap="round"/><path d="M14.5 2.5l-.6 3.9-3.9-.4" fill="none" stroke="${col}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function makeGearView(target) {
  const v = { target, ins: new Set(), angle: {}, turning: false, turnV: 0, jamT: 0, mode: 'xray', chal: 0, hint: 0, solved: new Set(), hl: new Set() };
  Object.keys(G).forEach(g => v.angle[g] = 0);
  const [x0, y0, x1, y1] = ART.plate, pad = 40, VB = [x0 - pad, y0 - pad, x1 - x0 + 2 * pad + 30, y1 - y0 + 2 * pad + 40];
  v.build = body => {
    const board = h('div', 'board'); body.appendChild(board);
    const svg = sv('svg', { viewBox: VB.join(' '), preserveAspectRatio: 'xMidYMid meet' }); board.appendChild(svg);
    svg.innerHTML = ART.game + '</g>';
    v.svg = svg; v.board = board;
    // split every gear into: static shadow, rotating body, static label; add tap + highlight ring
    v.gearEl = {};
    svg.querySelectorAll('g[id^="Gear_"]').forEach(g => {
      const m = g.id.match(/^Gear_([A-Z]+)_T/); if (!m) return; const id = m[1], d = G[id];
      const kids = [...g.childNodes]; const rot = sv('g', {}), stat = sv('g', {}), shadow = sv('g', {});
      kids.forEach(k => {
        if (k.nodeType !== 1) return;
        const isShadow = k.getAttribute('transform') && k.getAttribute('fill-opacity');
        const isHubShadow = k.tagName === 'circle' && k.getAttribute('fill-opacity') && Math.abs(+k.getAttribute('cx') - d.x) > 1;
        const isLabel = k.tagName === 'text' || (k.tagName === 'rect' && k.getAttribute('rx') === '18');
        if (isShadow) { k.removeAttribute('transform'); shadow.appendChild(k); } else if (isHubShadow) k.remove(); else if (isLabel) stat.appendChild(k); else rot.appendChild(k);
      });
      g.innerHTML = '';
      const hlr = sv('circle', { class: 'hlring', cx: d.x, cy: d.y, r: d.dia / 2 + 52, fill: 'none', stroke: COL.primary, 'stroke-width': 16, 'stroke-dasharray': '28 18' });
      g.append(hlr, shadow, rot, stat);
      g.classList.add('gear');
      v.gearEl[id] = { g, rot, shadow, hl: hlr };
      if (!FIXED.includes(id)) {
        sv('circle', { cx: d.x, cy: d.y, r: d.dia / 2 + 10, fill: 'transparent' }, g);
        g.addEventListener('click', () => { audioInit(); toggle(id); });
      }
    });
    // jam badge + output direction arrows live in their own layer
    v.fx = sv('g', { 'pointer-events': 'none' }, svg);
    // controls
    const seg = h('div', 'seg'); seg.innerHTML = '<button data-m="xray" class="on">X-ray</button><button data-m="chal">Challenges</button>';
    seg.querySelectorAll('button').forEach(b => b.onclick = () => { audioInit(); sfx.tap(); setMode(b.dataset.m); });
    const panel = h('div', 'panel'); body.append(seg, panel); v.panel = panel; v.seg = seg;
    sync();
  };
  v.slot = () => {                        // where the plate image sits inside the board svg (for the fly-in)
    const r = v.svg.getBoundingClientRect(), s = Math.min(r.width / VB[2], r.height / VB[3]), w = VB[2] * s, hh = VB[3] * s;
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - hh) / 2, right: r.left + (r.width + w) / 2, bottom: r.top + (r.height + hh) / 2 };
  };
  function toggle(id) {
    if (v.ins.has(id)) v.ins.delete(id); else v.ins.add(id);
    sfx.clunk(); const el = v.gearEl[id].g; el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.0)' }], { duration: 1 });
    v.jamT = 0; sync(); checkSolved();
  }
  function sync() {
    Object.entries(v.gearEl).forEach(([id, e]) => { e.g.classList.toggle('out', !FIXED.includes(id) && !v.ins.has(id)); e.g.classList.toggle('hl', v.hl.has(id)); });
    renderPanel();
  }
  function setMode(m) { v.mode = m; v.seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); v.hl.clear(); if (m === 'chal') v.hint = 0; sync(); }
  function boardWord() { const r = gearSpin(v.ins); return r; }
  function renderPanel() {
    const p = v.panel; p.innerHTML = '';
    const pr = h('div', 'prompt'); p.appendChild(pr);
    if (v.mode === 'xray') {
      const r = boardWord();
      if (r.jam) pr.innerHTML = `<p class="eyebrow">Jammed</p><p><b>${r.jam.map(g => LABEL[g]).join(', ')}</b> push against each other in a loop. Pull one of them out.</p>`;
      else pr.innerHTML = `<p class="eyebrow">X-ray</p><p>Tap gears to push them in or pull them out, just like on the wall. Then hold <b>Turn</b> to see what spins.</p>`;
      const row = h('div', 'ctrlrow'); p.appendChild(row);
      row.appendChild(turnButton());
      const clr = h('button', 'btn light', 'All out'); clr.onclick = () => { v.ins.clear(); sfx.clunk(); sync(); }; row.appendChild(clr); clr.style.flex = '0 0 34%';
    } else {
      const chips = h('div', 'chips'); p.insertBefore(chips, pr);
      CHAL.forEach((c, i) => { const b = h('button', (i === v.chal ? 'on' : '') + (v.solved.has(c.id) ? ' solved' : ''), c.id); b.onclick = () => { sfx.tap(); v.chal = i; v.hint = 0; v.hl.clear(); sync(); }; chips.appendChild(b); });
      const c = CHAL[v.chal], g = c.goal;
      const tags = Object.entries(g).map(([k, d]) => k === 'F' ? `<span class="tag">F spins too</span>` : `<span class="tag">${ARROW(d === 1, COL.primary)}${k === 'OL' ? 'Left' : 'Right'} ${d === 1 ? 'clockwise' : 'anticlockwise'}</span>`).join('');
      const goal = h('div', 'goal', `${tags}<span class="mono" style="font-size:14px;color:var(--g75)">${c.moves} move${c.moves > 1 ? 's' : ''}</span>`); p.insertBefore(goal, pr);
      const prev = v.chal ? CHAL[v.chal - 1] : null;
      const change = prev ? diff(prev.answer, c.answer) : diff([], c.answer);
      if (goalOK(v.ins, g)) pr.innerHTML = `<p class="eyebrow">Solved</p><p>That works. Hold <b>Turn</b> to watch it.</p>`;
      else if (v.hint === 0) pr.innerHTML = `<p class="eyebrow">Stuck on ${c.id}?</p><p>Copy your wall onto the board, then pick a hint. Each one gives away a bit more.</p>`;
      else if (v.hint === 1) pr.innerHTML = `<p class="eyebrow">Hint 1 · nudge</p><p>${NUDGE[c.id]}</p>`;
      else if (v.hint === 2) pr.innerHTML = `<p class="eyebrow">Hint 2 · which gears</p><p>${prev ? `From the ${prev.id} answer, change` : 'Push in'} <b>${change.map(x => LABEL[x.g]).join(', ')}</b>. They’re circled.</p>`;
      else pr.innerHTML = `<p class="eyebrow">Hint 3 · the answer</p><p>${change.map(x => `${x.in ? 'push in' : 'pull out'} <b>${LABEL[x.g]}</b>`).join(' · ')}. Lost? Pull everything out and push in <b>${c.fresh.map(x => LABEL[x]).join(', ')}</b>.</p>`;
      const hints = h('div', 'hints'); p.appendChild(hints);
      ['Nudge', 'Gears', 'Answer'].forEach((lab, i) => {
        const b = h('button', 'btn ' + (v.hint > i ? '' : 'light'), lab); b.disabled = i > v.hint;
        b.onclick = () => { audioInit(); sfx.tap(); v.hint = Math.max(v.hint, i + 1); v.hl = new Set(v.hint >= 2 ? change.map(x => x.g) : []); if (v.hint === 3) { v.ins = new Set(c.answer); sfx.clunk(); } sync(); checkSolved(); };
        hints.appendChild(b);
      });
      const row = h('div', 'ctrlrow'); p.appendChild(row); row.appendChild(turnButton());
    }
  }
  function diff(a, b) { const A = new Set(a), B = new Set(b), out = []; ART.movable.forEach(g => { if (A.has(g) && !B.has(g)) out.push({ g, in: false }); if (!A.has(g) && B.has(g)) out.push({ g, in: true }); }); return out; }
  function turnButton() {
    const b = h('button', 'btn', `${ARROW(true)}<span>Hold to turn</span>`);
    const down = e => { e.preventDefault(); audioInit(); b.classList.add('down'); v.turning = true; };
    const up = () => { b.classList.remove('down'); v.turning = false; };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
    return b;
  }
  function checkSolved() {
    if (v.mode !== 'chal') return; const c = CHAL[v.chal];
    if (goalOK(v.ins, c.goal) && !v.solved.has(c.id)) { v.solved.add(c.id); if (v.hint < 3) { sfx.ok(); award('gears'); } sync(); }
  }
  v.start = () => { if (!stamps.has('gears')) toast2(v, 'Tap a gear to pull it out or push it in'); };
  v.tick = (dt) => {
    const k = dt / 1000, r = gearSpin(v.ins);
    v.turnV = lerp(v.turnV, v.turning && !r.jam ? 1 : 0, Math.min(1, k * 6));
    if (v.turning && r.jam) { if (v.jamT === 0) { sfx.err(); } v.jamT += k; } else v.jamT = 0;
    const fx = v.fx; fx.innerHTML = '';
    Object.entries(v.gearEl).forEach(([id, e]) => {
      const d = G[id]; let a = v.angle[id];
      if (r.dir && id in r.dir) a += r.dir[id] * v.turnV * k * 90 * (16 / d.teeth);
      const jig = v.jamT > 0 && r.jam && r.jam.includes(id) ? Math.sin(v.jamT * 60) * 2.5 : 0;
      v.angle[id] = a; e.rot.setAttribute('transform', `rotate(${a + jig} ${d.x} ${d.y})`); e.shadow.setAttribute('transform', `translate(10,13) rotate(${a} ${d.x} ${d.y})`);
    });
    // what spins: arrows on the outputs while turning; jam ring around the loop
    if (v.turnV > .05 && r.dir) ['OL', 'OR', 'F'].forEach(id => { if (!(id in r.dir) || (id === 'F' && !v.ins.has('F'))) return; const d = G[id], cw = r.dir[id] === 1, rr2 = d.dia / 2 + 58;
      const a0 = -150, a1 = -30, p = a => [d.x + rr2 * Math.cos(a * Math.PI / 180), d.y + rr2 * Math.sin(a * Math.PI / 180)];
      const [sx2, sy2] = p(cw ? a0 : a1), [ex, ey] = p(cw ? a1 : a0);
      const arcD = `M${sx2},${sy2} A${rr2},${rr2} 0 0 ${cw ? 1 : 0} ${ex},${ey}`;
      sv('path', { d: arcD, fill: 'none', stroke: COL.light, 'stroke-width': 44, 'stroke-linecap': 'round', opacity: v.turnV }, fx);
      sv('path', { d: arcD, fill: 'none', stroke: COL.primary, 'stroke-width': 26, 'stroke-linecap': 'round', opacity: v.turnV }, fx);
      const ang = (cw ? a1 + 90 : a0 - 90) * Math.PI / 180, ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      const headD = `M${ex - 46 * ux + 38 * nx},${ey - 46 * uy + 38 * ny} L${ex + 12 * ux},${ey + 12 * uy} L${ex - 46 * ux - 38 * nx},${ey - 46 * uy - 38 * ny}`;
      sv('path', { d: headD, fill: 'none', stroke: COL.light, 'stroke-width': 44, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: v.turnV }, fx);
      sv('path', { d: headD, fill: 'none', stroke: COL.primary, 'stroke-width': 26, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: v.turnV }, fx);
    });
    if (r.jam && (v.turning || v.mode === 'xray')) {
      const pts = r.jam.map(g => [G[g].x, G[g].y]);
      sv('path', { d: 'M' + pts.map(p => p.join(',')).join(' L') + ' Z', fill: 'rgba(30,85,255,.25)', stroke: COL.light, 'stroke-width': 22, 'stroke-dasharray': '44 26', 'stroke-linejoin': 'round' }, fx);
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      sv('rect', { x: cx - 190, y: cy - 62, width: 380, height: 124, rx: 62, fill: COL.ink, stroke: COL.light, 'stroke-width': 10 }, fx);
      const t = sv('text', { x: cx, y: cy + 15, 'text-anchor': 'middle', 'font-family': F.d, 'font-weight': 700, 'font-size': 84, fill: COL.light }, fx); t.setAttribute('y', cy + 29); t.textContent = 'JAMMED';
    }
  };
  return v;
}
function toast2(v, s) { const t = h('div', '', s); t.style.cssText = 'position:absolute;left:50%;top:8px;transform:translateX(-50%);background:var(--ink);color:var(--light);border-radius:99px;padding:9px 14px;font:700 14px/1 var(--body);white-space:nowrap;transition:opacity .4s;z-index:2'; v.board.appendChild(t); setTimeout(() => t.style.opacity = 0, 2600); setTimeout(() => t.remove(), 3100); }

/* =====================================================================
   FINISH + CONFETTI
   ===================================================================== */
function showFinish() { show('finish'); confetti(true); }
function confetti(big) {
  const cv = $('confetti'), c = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const cols = [COL.primary, COL.accent, COL.ink, COL.p40, COL.light], P = [];
  for (let i = 0; i < (big ? 160 : 70); i++) P.push({ x: innerWidth / 2 + rand(-60, 60), y: innerHeight * .45, vx: rand(-420, 420), vy: rand(-900, -300), r: rand(0, 6), vr: rand(-12, 12), w: rand(7, 13), col: cols[i % cols.length] });
  let last = performance.now(); const t0 = last;
  const f = now => { const k = Math.min(.05, (now - last) / 1000); last = now; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, innerWidth, innerHeight);
    P.forEach(p => { p.vy += 1500 * k; p.x += p.vx * k; p.y += p.vy * k; p.r += p.vr * k; c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); c.restore(); });
    if (now - t0 < 2600) requestAnimationFrame(f); else c.clearRect(0, 0, innerWidth, innerHeight); };
  requestAnimationFrame(f);
}

/* =====================================================================
   WIRING
   ===================================================================== */
fillTargets(); renderStamps(); updateCount();
$('goBtn').addEventListener('click', startCamera);
$('browseBtn').addEventListener('click', () => { audioInit(); $('startTargets').scrollIntoView({ behavior: 'smooth' }); $('startTargets').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 500 }); });
$('rescan').addEventListener('click', () => { sfx.tap(); leavePlay(); });
$('camBack').addEventListener('click', () => { show('start'); updateCount(); renderStamps(); });
$('finishBack').addEventListener('click', () => leavePlay());
if (params.has('open')) openTarget(+params.get('open'), null);       // tests: jump straight into a card
if (params.has('autostart')) startCamera();
window.L5AR = { ar, stamps, CARDS, openTarget, gearSpin };
