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
let finishPending = false;
function award(id, quiet) {
  if (stamps.has(id)) return false;
  stamps.add(id); try { localStorage.setItem('l5ar-stamps', JSON.stringify([...stamps])); } catch (e) {}
  renderStamps(id); updateCount();
  if (!quiet) { sfx.win(); confetti(); buzz([20, 40, 20]); }
  if (stamps.size === STAMP_IDS.length) finishPending = true;
  return true;
}
function maybeFinish() { if (finishPending) { finishPending = false; setTimeout(showFinish, 400); return true; } return false; }

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
    d.innerHTML = `<img src="${t.img}" alt=""><b>${t.label}</b>`; d.onclick = () => { audioInit(); askGyro(); openTarget(i, null); }; st.appendChild(d);
    const m = h('img'); m.src = t.img; m.alt = t.label; m.dataset.target = t.stamp; mini.appendChild(m);
  });
  // 6th tile on the start grid: progress
  const p = h('button', 't'); p.style.cssText = 'appearance:none;cursor:pointer;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:6px;background:var(--ink);color:var(--light);box-shadow:3px 4px 0 var(--accent)';
  p.innerHTML = `<span style="font:700 30px/1 var(--display)" id="stampCount">0/5</span><span style="font:600 10px/1 var(--mono);letter-spacing:.12em">CARDS · VIEW</span>`; p.onclick = () => { audioInit(); askGyro(); showCollection(); }; st.appendChild(p);
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
  ar.active = null; ar.acquire = null; ar.locking = false; ar.sq = null; holoStop(); $('vf').classList.remove('found'); setRing(0);
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
  ar.active = { i, el }; ar.sq = null; $('vf').classList.add('found');
  camText(TARGETS[i].label, 'Got it. Hold still…'); blip(660, .05, 'sine', .04); blip(990, .08, 'sine', .03, .06);
  const t0 = performance.now(); ar.acquire = t0; ar.lockMs = HOLO_MS[TARGETS[i].kind];
  holoStart(i, el);
  const loop = now => {
    if (ar.acquire !== t0 || !ar.active || ar.active.i !== i) return;
    const k = clamp((now - t0) / ar.lockMs, 0, 1); setRing(k);
    if (k >= 1) lockOn(i, el); else requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function onLost(i) {
  if (!ar.active || ar.active.i !== i || ar.locking) return;
  ar.active = null; ar.acquire = null; holoStop(); $('vf').classList.remove('found'); setRing(0); camText(null, 'Lost it. Keep the whole card in the frame.');
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
  try { const sc = ar.scene, gl = sc.renderer.domElement, r = gl.getBoundingClientRect(); sc.renderer.render(sc.object3D, sc.camera); c.drawImage(gl, r.left, r.top, r.width, r.height); } catch (e) {}   // keep the hologram in the frozen frame
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
  snapshot(); holoStop();
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
   AR WOW LAYER: live tracking brackets + 3D hologram reveal before the lock
   cards: the printed code lines peel off the card and fan out towards you, with a scan beam + particles
   gears: every gear rises out of the plate in 3D, one after another along the drive train, and spins
   ===================================================================== */
const HOLO_MS = { card: 1500, gears: 1900 };
const holoCache = {};
function lineTokens(i) {                        // read the printed code lines (with colours) out of the card art
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${ART.cards[i]}</svg>`, 'image/svg+xml');
  const out = {};
  doc.querySelectorAll('text[x="58"]').forEach(t => {
    const n = Math.round((+t.getAttribute('y') - 96) / 36) + 1;
    out[n] = [...t.querySelectorAll('tspan')].map(sp => [sp.textContent, sp.getAttribute('fill')]);
  });
  return out;
}
function lineTexture(tokens, n, hot) {
  const W = 1280, H = 76, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  c.fillStyle = hot ? 'rgba(30,85,255,.92)' : 'rgba(16,22,44,.94)'; rr(c, 0, 0, W, H, 14); c.fill();
  c.strokeStyle = '#3D6BFF'; c.lineWidth = 4; rr(c, 2, 2, W - 4, H - 4, 12); c.stroke();
  c.fillStyle = '#3D6BFF'; c.fillRect(0, 0, 12, H);
  c.font = `400 30px ${F.m}`; c.fillStyle = COL.g60; c.textAlign = 'right'; c.fillText(String(n), 62, 50);
  c.textAlign = 'left'; c.font = `400 40px ${F.m}`; let x = 88;
  (tokens || []).forEach(([s, col]) => { c.fillStyle = hot ? COL.light : (col || COL.code); c.fillText(s, x, 52); x += c.measureText(s).width; });
  const tex = new AFRAME.THREE.CanvasTexture(cv); if ('colorSpace' in tex) tex.colorSpace = AFRAME.THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
function gearShape(THREE, r, teeth, hole) {
  const s = new THREE.Shape(), ro = r * 1.1, ri = r * .9, p = Math.PI * 2 / teeth;
  for (let k = 0; k < teeth; k++) {
    const a = k * p; const pts = [[ri, a - .5 * p], [ri, a - .25 * p], [ro, a - .13 * p], [ro, a + .13 * p], [ri, a + .25 * p]];
    pts.forEach(([rad, aa], j) => { const x = Math.cos(aa) * rad, y = Math.sin(aa) * rad; (k === 0 && j === 0) ? s.moveTo(x, y) : s.lineTo(x, y); });
  }
  s.closePath();
  const hp = new THREE.Path(); hp.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(hp);
  return s;
}
function buildHolo(i, el) {
  if (holoCache[i]) return holoCache[i];
  const THREE = AFRAME.THREE, t = TARGETS[i], g = new THREE.Group(); el.object3D.add(g);
  const H = { group: g, kind: t.kind, parts: [] };
  const U = v => v / 640, PY = y => U(206 - y);
  if (t.kind === 'card') {
    const toks = lineTokens(t.card), ns = Object.keys(toks).map(Number).sort((a, b) => a - b);
    ns.forEach((n, k) => {
      const mat = new THREE.MeshBasicMaterial({ map: lineTexture(toks[n], n, false), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(U(600), U(600) * 76 / 1280), mat);
      m.position.set(U(46 + 300) - .5, PY(LINE_Y(n)), 0); g.add(m);
      const glowM = new THREE.Mesh(new THREE.PlaneGeometry(U(620), U(54)), new THREE.MeshBasicMaterial({ color: 0x3D6BFF, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      glowM.position.copy(m.position); g.add(glowM);
      H.parts.push({ m, glow: glowM, k, y0: m.position.y });
    });
    // dark veil over the printed card so the floating lines read cleanly
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 412 / 640), new THREE.MeshBasicMaterial({ color: 0x0A0F22, transparent: true, opacity: 0, depthWrite: false }));
    veil.position.z = .001; g.add(veil); H.veil = veil;
    // scan beam + frame
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.06, U(10)), new THREE.MeshBasicMaterial({ color: 0xF8F9FB, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(beam); H.beam = beam;
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.02, 412 / 640 + .02)), new THREE.LineBasicMaterial({ color: 0x3D6BFF, transparent: true, opacity: 0 }));
    g.add(frame); H.frame = frame;
  } else {
    // gears: wall coords -> target units (the target image is the plate crop used for the .mind file)
    const [x0, y0, x1, y1] = ART.plate, pad = 40, vw = x1 - x0 + 2 * pad + 30, vh = y1 - y0 + 2 * pad + 40, vx = x0 - pad, vy = y0 - pad;
    const P = (X, Y) => [(X - (vx + vw / 2)) / vw, -(Y - (vy + vh / 2)) / vw];
    const spin = gearSpin(['A', 'B', 'D', 'G', 'J']).dir || {};
    const order = ['H', 'G', 'B', 'F', 'C', 'J', 'D', 'A', 'OR', 'E', 'OL'];
    order.forEach((id, k) => {
      const d = G[id], r = d.dia / 2 / vw, [px, py] = P(d.x, d.y);
      const col = id === 'H' ? 0x1E55FF : id.startsWith('O') ? 0xF8F9FB : 0xD5DFFC;
      const geo = new THREE.ExtrudeGeometry(gearShape(THREE, r, d.teeth, r * .22), { depth: r * .28, bevelEnabled: true, bevelThickness: r * .04, bevelSize: r * .03, bevelSegments: 2 });
      const mat = new THREE.MeshStandardMaterial({ color: col, metalness: .35, roughness: .35, emissive: id === 'H' ? 0x0A2490 : 0x0B1640, emissiveIntensity: .6, transparent: true, opacity: 0 });
      const m = new THREE.Mesh(geo, mat); m.position.set(px, py, 0); g.add(m);
      const ringM = new THREE.Mesh(new THREE.RingGeometry(r * 1.15, r * 1.25, 48), new THREE.MeshBasicMaterial({ color: 0x3D6BFF, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ringM.position.set(px, py, .002); g.add(ringM);
      H.parts.push({ m, ring: ringM, k, dir: spin[id] || 0, teeth: d.teeth });
    });
    if (!g.parent.parent) {}
    const lt = new THREE.PointLight(0xA1B7FD, 2.2, 4); lt.position.set(.2, .3, .6); g.add(lt);
    const amb = new THREE.AmbientLight(0xffffff, .55); g.add(amb);
  }
  // particles drifting up off the target
  const N = 70, pos = new Float32Array(N * 3), seeds = [];
  for (let k = 0; k < N; k++) { seeds.push([rand(-.5, .5), rand(-.3, .3), rand(0, 1), rand(.4, 1)]); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xA1B7FD, size: .012, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(pts); H.pts = pts; H.seeds = seeds;
  H.t0 = 0; H.running = false; g.visible = false;
  holoCache[i] = H; return H;
}
function holoStart(i, el) { try { const H = buildHolo(i, el); H.t0 = performance.now(); H.running = true; H.group.visible = true; ar.holo = H; } catch (e) { console.warn(e); } }
function holoStop() { if (ar.holo) { ar.holo.running = false; ar.holo.group.visible = false; ar.holo = null; } }
function holoTick(now) {
  const H = ar.holo; if (!H || !H.running) return;
  const dur = HOLO_MS[H.kind], k = clamp((now - H.t0) / dur, 0, 1), sec = (now - H.t0) / 1000;
  if (H.kind === 'card') {
    if (H.beam) { const b = clamp(k / .3, 0, 1); H.beam.position.set(0, lerp(.34, -.34, ease(b)), .01); H.beam.material.opacity = b < 1 ? .9 : 0; }
    H.frame.material.opacity = clamp(k * 3, 0, 1) * .9; H.frame.position.z = .004; H.veil.material.opacity = clamp((k - .15) * 2.5, 0, 1) * .62;
    H.parts.forEach(p => {
      const st = .18 + p.k * .07, q = clamp((k - st) / .35, 0, 1), e = back(q);
      p.m.material.opacity = clamp(q * 2, 0, 1);
      const z = e * (.06 + p.k * .018);
      p.m.position.z = z; p.m.rotation.x = -.12 * e; p.m.position.y = p.y0;
      p.glow.position.set(p.m.position.x, p.m.position.y, z - .002); p.glow.rotation.x = p.m.rotation.x;
      p.glow.material.opacity = q > 0 ? .35 * (1 - q) + .12 + .08 * Math.sin(sec * 8 + p.k) : 0;
    });
  } else {
    H.parts.forEach(p => {
      const st = p.k * .07, q = clamp((k - st) / .3, 0, 1), e = back(q);
      p.m.material.opacity = clamp(q * 1.6, 0, 1); p.m.position.z = e * .03 + (p.dir ? .008 * Math.sin(sec * 3 + p.k) : 0);
      p.m.rotation.z += p.dir * .045 * (16 / p.teeth) * clamp(q * 2, 0, 1);
      p.ring.material.opacity = q > 0 && q < 1 ? (1 - q) : (p.dir ? .25 + .2 * Math.sin(sec * 6 + p.k) : 0);
      p.ring.scale.setScalar(1 + (1 - q) * .6);
    });
  }
  const arr = H.pts.geometry.attributes.position.array;
  H.seeds.forEach((s, j) => { const life = (sec * s[3] + s[2]) % 1; arr[j * 3] = s[0] + Math.sin(sec * 2 + j) * .01; arr[j * 3 + 1] = s[1] + life * .25; arr[j * 3 + 2] = .01 + life * .18; });
  H.pts.geometry.attributes.position.needsUpdate = true; H.pts.material.opacity = clamp(k * 3, 0, 1) * .9;
}

/* live corner brackets that hug the card while tracking */
function trackTick() {
  const svg = $('trk'); if (!svg) return;
  if (!ar.active || ar.locking || $('cam').hidden) { svg.style.opacity = 0; return; }
  let q; try { q = projectQuad(ar.active.el, TARGETS[ar.active.i].aspect); } catch (e) { return; }
  ar.sq = ar.sq ? ar.sq.map((p, j) => [lerp(p[0], q[j][0], .45), lerp(p[1], q[j][1], .45)]) : q;
  const s = ar.sq; svg.style.opacity = 1;
  svg.querySelector('.poly').setAttribute('points', s.map(p => p.join(',')).join(' '));
  const L = .2, corners = s.map((p, j) => { const a = s[(j + 3) % 4], b = s[(j + 1) % 4]; return `M${lerp(p[0], a[0], L)},${lerp(p[1], a[1], L)} L${p[0]},${p[1]} L${lerp(p[0], b[0], L)},${lerp(p[1], b[1], L)}`; }).join(' ');
  svg.querySelector('.corners').setAttribute('d', corners);
  const lab = svg.querySelector('.lab'), k = clamp((performance.now() - ar.acquire) / ar.lockMs, 0, 1);
  lab.setAttribute('transform', `translate(${s[0][0]},${s[0][1] - 16})`);
  lab.querySelector('text').textContent = `${TARGETS[ar.active.i].label}  ·  ${Math.round(k * 100)}%`;
  lab.querySelector('rect').setAttribute('width', 26 + lab.querySelector('text').textContent.length * 9.2);
}
(function arLoop(now) { holoTick(now); trackTick(); requestAnimationFrame(arLoop); })(0);

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
  $('ttlConcept').textContent = t.kind === 'card' ? CARDS[t.card].concept : 'challenge help';
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
  $('results').hidden = true; $('how').hidden = true; if (maybeFinish()) { if (view && view.destroy) view.destroy(); view = null; cancelAnimationFrame(rafId); return; }
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
    const stage = h('div', 'stage'), scene = h('div', 'scene' + (def.dark ? ' dark' : '')), cv = h('canvas'), con = h('div', 'console', '<span class="hd">OUTPUT</span>');
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
  v.toDesign = (x, y) => { const s = v.sw / 1000; return { x: x / s, y: y / s - (v.oy || 0) }; };
  v.slot = () => v.wrap.getBoundingClientRect();
  v.out = (s, kind) => { const d = h('div', 'ln' + (kind ? ' ' + kind : '')); d.textContent = s; v.con.appendChild(d); const lines = v.con.querySelectorAll('.ln'); if (lines.length > 6) lines[0].remove(); };
  v.clearOut = () => v.con.querySelectorAll('.ln').forEach(e => e.remove());
  v.start = () => def.start(v);
  v.tick = (dt) => {
    v.t += dt / 1000; v.run.update(dt); def.update && def.update(v, dt);
    const c = v.ctx, dpr = v.cv.width / v.sw; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, v.sw, v.sh);
    c.fillStyle = def.dark ? COL.ink : COL.light; c.fillRect(0, 0, v.sw, v.sh);
    const s = v.sw / 1000; v.DH = v.sh / s; v.oy = Math.max(0, (v.DH - 560) / 2); c.scale(s, s);     // width-fit; scenes get the full height
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
   GAME KIT: dark arcade scenes, juice (particles, pops, shake), scores, results
   ===================================================================== */
const NEON = '#3D6BFF';
function glow(c, col, blur) { c.shadowColor = col; c.shadowBlur = blur; }
function noGlow(c) { c.shadowBlur = 0; c.shadowColor = 'transparent'; }
function makeFX() {
  const fx = { parts: [], pops: [], rings: [], shake: 0, flash: 0, flashCol: COL.primary, slow: 0 };
  fx.burst = (x, y, n, cols, sp = 520, size = 9, grav = 900) => { for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(.25, 1) * sp; fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * .25, life: rand(.5, 1.1), t: 0, s: rand(.5, 1) * size, col: cols[i % cols.length], rot: rand(0, 6), vr: rand(-10, 10), grav, sq: Math.random() < .5 }); } };
  fx.pop = (x, y, text, col = COL.light, size = 56) => fx.pops.push({ x, y, text, col, size, t: 0 });
  fx.ring = (x, y, col = NEON, r0 = 20, r1 = 220) => fx.rings.push({ x, y, col, r0, r1, t: 0 });
  fx.hit = (k = 1) => { fx.shake = Math.max(fx.shake, k); };
  fx.flashIt = (col = COL.primary, k = 1) => { fx.flash = k; fx.flashCol = col; };
  fx.update = dt => {
    const k = dt / 1000; fx.shake = Math.max(0, fx.shake - k * 3); fx.flash = Math.max(0, fx.flash - k * 3);
    fx.parts.forEach(p => { p.t += k; p.vy += p.grav * k; p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k; p.vx *= (1 - k * .8); });
    fx.parts = fx.parts.filter(p => p.t < p.life); fx.pops.forEach(p => p.t += k); fx.pops = fx.pops.filter(p => p.t < .9); fx.rings.forEach(r => r.t += k); fx.rings = fx.rings.filter(r => r.t < .5);
  };
  fx.pre = c => { if (fx.shake > 0) c.translate(rand(-1, 1) * 18 * fx.shake, rand(-1, 1) * 14 * fx.shake); };
  fx.draw = c => {
    fx.rings.forEach(r => { const q = r.t / .5; c.globalAlpha = 1 - q; glow(c, r.col, 20); ring(c, r.x, r.y, lerp(r.r0, r.r1, easeOut(q)), r.col, 10 * (1 - q) + 2); }); c.globalAlpha = 1;
    fx.parts.forEach(p => { c.globalAlpha = clamp(1 - p.t / p.life, 0, 1); c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; glow(c, p.col, 12); if (p.sq) c.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); else { c.beginPath(); c.arc(0, 0, p.s / 2, 0, 7); c.fill(); } c.restore(); }); c.globalAlpha = 1;
    fx.pops.forEach(p => { const q = p.t / .9, s = back(clamp(p.t * 5, 0, 1)); c.globalAlpha = 1 - clamp((q - .55) / .45, 0, 1); c.save(); c.translate(p.x, p.y - q * 70); c.scale(s, s); glow(c, NEON, 24); txt(c, p.text, 0, 0, `700 ${p.size}px ${F.d}`, p.col, 'center', 'middle'); c.restore(); }); c.globalAlpha = 1; noGlow(c);
    if (fx.flash > 0) { c.globalAlpha = fx.flash * .35; c.fillStyle = fx.flashCol; c.fillRect(-600, -600, 2200, 1800); c.globalAlpha = 1; }
  };
  return fx;
}
/* dark arcade ground: ink + faint blueprint grid + vignette */
function arcadeBG(c, t) {
  c.fillStyle = COL.ink; c.fillRect(-600, -600, 2200, 1800);
  c.strokeStyle = 'rgba(61,107,255,.10)'; c.lineWidth = 2; c.beginPath();
  for (let x = -40; x <= 1040; x += 40) { c.moveTo(x, -600); c.lineTo(x, 1200); } for (let y = -600; y <= 1200; y += 40) { c.moveTo(-600, y); c.lineTo(1600, y); } c.stroke();
  const g = c.createRadialGradient(500, 280, 120, 500, 280, 700); g.addColorStop(0, 'rgba(30,85,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = g; c.fillRect(-600, -600, 2200, 1800);
}
function hudScore(c, score, combo, x = 36, y = 70) {
  const oy = view && view.oy || 0; y -= oy;
  glow(c, NEON, 18); txt(c, score.toLocaleString(), x, y, `700 64px ${F.d}`, COL.light); noGlow(c);
  txt(c, 'SCORE', x + 2, y + 30, `600 22px ${F.m}`, COL.p60);
  if (combo >= 2) { const s = 1 + .08 * Math.sin(performance.now() / 90); c.save(); c.translate(x + 2, y + 84); c.scale(s, s); glow(c, NEON, 28); txt(c, `×${combo} COMBO`, 0, 0, `700 40px ${F.d}`, combo >= 5 ? COL.light : COL.p40); c.restore(); noGlow(c); }
}
function hudLives(c, n, max = 3, x = 964, y = 54, icon = 'heart') {
  y -= (view && view.oy || 0);
  for (let i = 0; i < max; i++) { const cx = x - i * 52, on = i < n; c.globalAlpha = on ? 1 : .22; glow(c, on ? NEON : 'transparent', 16);
    c.beginPath(); c.moveTo(cx, y + 14); c.bezierCurveTo(cx - 26, y - 4, cx - 18, y - 24, cx, y - 10); c.bezierCurveTo(cx + 18, y - 24, cx + 26, y - 4, cx, y + 14); c.fillStyle = on ? COL.primary : COL.g60; c.fill(); }
  c.globalAlpha = 1; noGlow(c);
}

/* ---------- best scores + stars ---------- */
const BEST = (() => { try { return JSON.parse(localStorage.getItem('l5ar-best') || '{}'); } catch (e) { return {}; } })();
function saveBest() { try { localStorage.setItem('l5ar-best', JSON.stringify(BEST)); } catch (e) {} }
const starsFor = (score, th) => th.filter(t => score >= t).length;

/* ---------- golden cards: a second, harder target per game ---------- */
const GOLD = { broke: 20000, procrastination: 50000, deadline: 4000, lecture: 6500 };
function isGold(id) { return id === 'gears' ? CHAL.every(c => ((BEST.gearStars || {})[c.id] || 0) >= 3) : (BEST[id] || 0) >= GOLD[id]; }

/* ---------- how to play: plain-English code walkthrough + steps, auto-opens the first time ---------- */
const HOWTO = {
  broke: { title: 'CAUGHT?', code: [[3, 'if netflix.password_sharing_detected():', 'Netflix checks if you’re sharing a password. This is the line you’re checking.'], [4, '    raise BrokeError("Goodbye, food budget.")', 'Runs if the check is <b>True</b>. You’re caught.'], [6, '    print("Still on my friend’s account.")', 'Runs if the check is <b>False</b> (the else). You’re safe.']],
    steps: ['Each round the check returns something: <code>True</code>, <code>False</code>, or a little puzzle like <code>not True</code>.', 'Work out if it ends up <b>True</b> or <b>False</b>.', '<b>True</b> → tap <b>CAUGHT</b> (line 4). <b>False</b> → tap <b>SAFE</b> (line 6).', 'The first two rounds are practice. After that the timer gets shorter. 3 wrong and you’re out.'] },
  procrastination: { title: 'BREAK THE LOOP', code: [[3, 'while True:', '“Keep going forever.” Lines 4 to 8 run again and again.'], [5, '        study()', 'Tries to study… and fails every time.'], [8, '        time.sleep(30)', 'The end of the loop. <b>break</b> here jumps out.']],
    steps: ['The glowing dot runs round lines 3 → 8, just like the loop.', 'Tap <b>BREAK</b> when the dot is on <b>8</b>. Bang on = PERFECT.', 'Too early or too late costs a life. Every 3 laps you miss, the phone wins one too.', 'It gets faster every loop you break.'] },
  deadline: { title: 'CRACK THE DEADLINE', code: [[1, 'if days_left == 7:', 'With 7 days left you always chill. Day 7 never changes.'], [4, 'elif days_left == 1:', 'You control this line. It decides <b>which days you panic</b>.']],
    steps: ['The <b>GOAL</b> shows which days should panic (the blue ones).', 'Flick the <b>left wheel</b> for the comparison: <code>==</code> equal, <code>!=</code> not equal, <code>&lt;</code> less than, <code>&lt;=</code> less or equal, <code>&gt;</code> more than, <code>&gt;=</code> more or equal.', 'Flick the <b>right wheel</b> for the number. Your week updates as you go.', 'When it matches, <b>hold still</b> for a moment to lock it in. 45 seconds, +4s per crack.'] },
  lecture: { title: 'DO NOT DISTURB', code: [[3, 'try:', 'Python tries line 4…'], [4, '    lecture.listen(minutes=5)', '…which keeps running while you pay attention.'], [5, 'except AttentionSpanError:', 'Lose focus and it errors. Then lines 6 and 7 open your phone.']],
    steps: ['<b>Hold</b> the button with one thumb to keep listening.', '<b>Tap notifications away</b> with your other thumb. Each one drains your attention.', '<b>MUM CALLING</b> drains fast: swat it first. <b>FOCUS MODE</b> clears everything for bonus points.', '<b>EXAM INFO</b> is important: <b>don’t</b> swat it. Survive to 5:00.'] },
  gears: { title: 'GEAR HELP', code: [],
    steps: ['Pick the challenge you’re on (01 to 06).', '<b>Copy your wall:</b> tap gears to push them in or pull them out so this board matches yours.', 'Hold <b>Turn</b> to see what spins. Arrows show the direction.', 'Stuck? <b>Hint</b> circles the gears to change. <b>Answer</b> shows the full setup.'] },
};
const HOW_SEEN = (() => { try { return new Set(JSON.parse(localStorage.getItem('l5ar-how') || '[]')); } catch (e) { return new Set(); } })();
const seenHow = id => HOW_SEEN.has(id);
function showHow(id, after) {
  HOW_SEEN.add(id); try { localStorage.setItem('l5ar-how', JSON.stringify([...HOW_SEEN])); } catch (e) {}
  const d = HOWTO[id], m = $('how'); m.hidden = false; m.innerHTML = '';
  const sh = h('div', 'howsheet');
  sh.innerHTML = `<p class="eyebrow">How to play</p><div class="gname">${d.title}</div>
    ${d.code.length ? `<div class="howcode">${d.code.map(([n, c, ex]) => `<div class="hc"><span class="ln">${n}</span><code>${c.replace(/</g, '&lt;')}</code></div><p>${ex}</p>`).join('')}</div>` : ''}
    <ol class="howsteps">${d.steps.map(s => `<li><span>${s}</span></li>`).join('')}</ol>`;
  const b = h('button', 'btn', 'Got it'); b.onclick = () => { sfx.tap(); m.hidden = true; after && after(); };
  sh.appendChild(b); m.appendChild(sh);
  m.onclick = e => { if (e.target === m) { m.hidden = true; after && after(); } };
}

/* ---------- game intro panel (shared) ---------- */
function gameIntro(v, def) {
  const best = BEST[def.stamp] || 0, st = starsFor(best, def.stars);
  v.ui.clear();
  v.ui.prompt.className = 'prompt intro';
  v.ui.prompt.innerHTML = `<div class="gname">${def.game}</div><p>${def.tagline}</p>
    <div class="bestrow"><span class="stars sm">${[0, 1, 2].map(i => `<i class="${i < st ? 'on' : ''}"></i>`).join('')}</span><span>${best ? `Best <b>${best.toLocaleString()}</b>` : 'No score yet'}</span><span class="next">${st < 3 ? `next ★ at ${def.stars[st].toLocaleString()}` : 'all stars'}</span></div>`;
  v.ui.button(`${PLAY_ICON} Play`, () => { audioInit(); def.play(v); });
  v.ui.button('How to play', () => { sfx.tap(); showHow(def.stamp); }, 'light howbtn');
  const g = GOLD[def.stamp]; if (g) { const gl = h('p', 'goldline', isGold(def.stamp) ? '<b>GOLDEN CARD</b> unlocked' : `Golden card at <b>${g.toLocaleString()}</b>`); v.ui.el.appendChild(gl); }
}

/* =====================================================================
   RESULTS: score count-up, stars slam in, new best, holo card reveal
   ===================================================================== */
function showResults(v, def, score, lines = []) {
  const prev = BEST[def.stamp] || 0, isBest = score > prev;
  if (isBest) { BEST[def.stamp] = score; saveBest(); }
  const st = starsFor(score, def.stars), newStamp = st >= 1 && !stamps.has(def.stamp), newGold = GOLD[def.stamp] && score >= GOLD[def.stamp] && prev < GOLD[def.stamp];
  const r = $('results'); r.innerHTML = ''; r.hidden = false; r.className = 'screen';
  const box = h('div', 'rbox');
  box.innerHTML = `<p class="eyebrow">${def.game}</p>
    <div class="rscore" id="rScore">0</div>
    <div class="stars big">${[0, 1, 2].map(() => '<i></i>').join('')}</div>
    <div class="rbest">${isBest && prev ? '<b class="nb">NEW BEST</b>' : `Best ${Math.max(prev, score).toLocaleString()}`}${st < 3 ? `<span style="display:block;margin-top:10px;color:var(--p40)">next ★ at ${def.stars[st].toLocaleString()}</span>` : ''}</div>
    <div class="rlines">${lines.map(l => `<span>${l}</span>`).join('')}</div>`;
  r.appendChild(box);
  const holoSlot = h('div', 'holoslot'); r.appendChild(holoSlot);
  const btns = h('div', 'rbtns'); r.appendChild(btns);
  const again = h('button', 'btn', `${PLAY_ICON} Play again`); again.onclick = () => { sfx.tap(); r.hidden = true; if (!maybeFinish()) def.play(v); };
  const away = h('button', 'btn light', 'Scan something else'); away.onclick = () => { sfx.tap(); r.hidden = true; leavePlay(); };
  btns.append(again, away); btns.style.opacity = 0;
  // count up
  const el = box.querySelector('#rScore'), T0 = performance.now(), D = Math.min(1600, 500 + score / 4);
  let lastTick = 0;
  const up = now => { const k = clamp((now - T0) / D, 0, 1), val = Math.round(score * easeOut(k)); el.textContent = val.toLocaleString();
    if (now - lastTick > 55 && k < 1) { lastTick = now; blip(900 + 600 * k, .02, 'square', .015); }
    if (k < 1) requestAnimationFrame(up); else afterCount(); };
  requestAnimationFrame(up);
  function afterCount() {
    el.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.2,1.6,.4,1)' });
    const stars = box.querySelectorAll('.stars i');
    let i = 0;
    const next = () => {
      if (i < st) { const s = stars[i]; s.classList.add('on', 'slam'); blip(660 + i * 220, .14, 'triangle', .07); blip(990 + i * 330, .18, 'triangle', .05, .06); buzz(30); box.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-6px,4px)' }, { transform: 'translate(5px,-3px)' }, { transform: 'translate(0,0)' }], { duration: 220 }); i++; setTimeout(next, 380); }
      else {
        if (st === 3) confetti(true); else if (st) confetti();
        if (isBest && prev) { box.querySelector('.nb').classList.add('shine'); sfx.win(); }
        if (newStamp || newGold) { setTimeout(() => { if (newStamp) award(def.stamp, true); holoReveal(holoSlot, def.stamp, st, newGold); }, 300); setTimeout(() => btns.style.opacity = 1, 1900); }
        else btns.style.opacity = 1;
      }
    };
    setTimeout(next, 250);
  }
}

/* ---------- holographic collectible cards ---------- */
const HOLO = {
  broke: { name: 'CAUGHT?', file: 'broke.py', concept: 'if / else', icon: 'wallet' },
  procrastination: { name: 'BREAK THE LOOP', file: 'procrastination.py', concept: 'while / break', icon: 'loop' },
  deadline: { name: 'CRACK THE DEADLINE', file: 'deadline.py', concept: 'if / elif', icon: 'calendar' },
  lecture: { name: 'DO NOT DISTURB', file: 'lecture.py', concept: 'try / except', icon: 'phone' },
  gears: { name: 'GEAR BRAIN', file: 'gear machine', concept: 'drive trains', icon: 'gear' },
};
function holoArt(id, stars, gold) {
  const d = HOLO[id], cv = document.createElement('canvas'); cv.width = 600; cv.height = 840; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 600, 840); if (gold) { g.addColorStop(0, '#5A4210'); g.addColorStop(.5, '#1E1608'); g.addColorStop(1, '#6E5214'); } else { g.addColorStop(0, '#1A2A6E'); g.addColorStop(.5, COL.ink); g.addColorStop(1, '#0E1A4A'); } c.fillStyle = g; c.fillRect(0, 0, 600, 840);
  c.strokeStyle = 'rgba(161,183,253,.12)'; c.lineWidth = 2; for (let x = 0; x <= 600; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 840); c.stroke(); } for (let y = 0; y <= 840; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(600, y); c.stroke(); }
  c.font = `600 26px ${F.m}`; c.fillStyle = gold ? '#F2C94C' : COL.p40; c.textAlign = 'left'; c.fillText(gold ? 'GOLDEN · LEVEL 5' : 'LEVEL 5 · AR', 40, 66);
  c.textAlign = 'right'; c.fillText(d.file, 560, 66);
  // icon
  c.save(); c.translate(300, 330); glow(c, gold ? '#F2C94C' : NEON, 40); c.strokeStyle = COL.light; c.fillStyle = gold ? '#C9971C' : COL.primary; c.lineWidth = 14; c.lineJoin = 'round'; c.lineCap = 'round';
  if (d.icon === 'wallet') { rr(c, -150, -90, 300, 200, 36); c.fill(); c.stroke(); rr(c, -150, -130, 300, 90, 36); c.fillStyle = COL.accent; c.fill(); c.stroke(); for (let k = 0; k < 4; k++) { circle(c, -96 + k * 64, -140 - (k % 2) * 14, 26, COL.light); } }
  if (d.icon === 'loop') { c.beginPath(); c.arc(0, 0, 140, -.3, Math.PI * 1.75); c.stroke(); c.beginPath(); c.moveTo(118, -112); c.lineTo(150, -40); c.lineTo(76, -46); c.stroke(); c.lineWidth = 22; c.beginPath(); c.moveTo(-60, 40); c.lineTo(60, -40); c.stroke(); }
  if (d.icon === 'calendar') { rr(c, -130, -140, 260, 280, 30); c.fillStyle = COL.light; c.fill(); c.stroke(); c.fillStyle = COL.primary; c.fillRect(-123, -133, 246, 70); txt(c, '1', 0, 110, `700 180px ${F.d}`, COL.primary, 'center'); }
  if (d.icon === 'phone') { rr(c, -100, -170, 200, 340, 36); c.fillStyle = COL.ink; c.fill(); c.stroke(); for (let k = 0; k < 3; k++) { rr(c, -70, -120 + k * 80, 140, 60, 16); c.fillStyle = k === 1 ? COL.primary : COL.furniture; c.fill(); } c.lineWidth = 20; c.beginPath(); c.moveTo(-150, 150); c.lineTo(150, -150); c.strokeStyle = COL.p40; c.stroke(); }
  if (d.icon === 'gear') { c.beginPath(); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; [[-.13, 130], [-.07, 160], [.07, 160], [.13, 130]].forEach(([o, r], j) => { const x = Math.cos(a + o) * r, y = Math.sin(a + o) * r; (k === 0 && j === 0) ? c.moveTo(x, y) : c.lineTo(x, y); }); } c.closePath(); c.fill(); c.stroke(); circle(c, 0, 0, 46, COL.light); }
  c.restore(); noGlow(c);
  c.textAlign = 'center'; c.font = `700 ${d.name.length > 12 ? 64 : 80}px ${F.d}`; c.fillStyle = COL.light; c.fillText(d.name, 300, 610);
  c.font = `600 28px ${F.m}`; c.fillStyle = COL.p40; c.fillText(d.concept, 300, 656);
  for (let i = 0; i < 3; i++) { const x = 230 + i * 70, on = i < stars; c.save(); c.translate(x, 740); c.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 13 : 30, a = -Math.PI / 2 + k * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fillStyle = on ? COL.light : 'rgba(248,249,251,.15)'; if (on) glow(c, NEON, 20); c.fill(); c.restore(); noGlow(c); }
  c.strokeStyle = gold ? '#F2C94C' : COL.light; c.lineWidth = gold ? 10 : 6; rr(c, 14, 14, 572, 812, 30); c.stroke();
  return cv.toDataURL('image/png');
}
function holoCard(id, stars, gold) {
  const el = h('div', 'holo' + (gold ? ' gold' : ''));
  el.innerHTML = `<div class="holo-in"><img src="${holoArt(id, stars, gold)}" alt=""><i class="foil"></i><i class="glare"></i></div>`;
  tiltify(el);
  return el;
}
let tiltCards = new Set(), gyro = null;
function tiltify(el) {
  tiltCards.add(el);
  el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); setTilt(el, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); el._manual = performance.now(); });
}
function setTilt(el, x, y) {     // x, y in 0..1
  el.style.setProperty('--rx', ((.5 - y) * 22).toFixed(2) + 'deg'); el.style.setProperty('--ry', ((x - .5) * 26).toFixed(2) + 'deg');
  el.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); el.style.setProperty('--my', (y * 100).toFixed(1) + '%'); el.style.setProperty('--fp', (x * 200 + y * 100).toFixed(1) + '%');
}
(function tiltLoop(now) {
  tiltCards.forEach(el => {
    if (!el.isConnected) { tiltCards.delete(el); return; }
    if (el._manual && now - el._manual < 1500) return;
    let x, y; if (gyro) { x = clamp(.5 + gyro.g / 40, 0, 1); y = clamp(.5 + (gyro.b - 45) / 50, 0, 1); }
    else { x = .5 + Math.sin(now / 900) * .32; y = .5 + Math.cos(now / 1300) * .25; }
    setTilt(el, x, y);
  });
  requestAnimationFrame(tiltLoop);
})(0);
function askGyro() {
  const on = () => addEventListener('deviceorientation', e => { if (e.gamma != null) gyro = { g: e.gamma, b: e.beta }; });
  try { if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(s => { if (s === 'granted') on(); }).catch(() => {}); else on(); } catch (e) {}
}
function holoReveal(slot, id, stars, gold) {
  slot.innerHTML = '';
  const lab = h('p', 'eyebrow', gold ? 'GOLDEN CARD UNLOCKED' : 'NEW CARD UNLOCKED'); lab.style.cssText = `text-align:center;color:${gold ? '#F2C94C' : 'var(--p40)'};margin:0 0 10px`;
  const card = holoCard(id, stars, gold); card.classList.add('reveal');
  slot.append(lab, card);
  sfx.whoosh(); setTimeout(() => { [523, 784, 1046, 1568].forEach((f, i) => blip(f, .2, 'sine', .05, i * .07)); buzz([20, 30, 60]); confetti(true); }, 520);
}
function cardStars(id) { return id === 'gears' ? (BEST.gears || 1) : starsFor(BEST[id] || 0, CARDS.find(c => c.stamp === id).stars); }
function showCollection() {
  const r = $('results'); r.innerHTML = ''; r.hidden = false; r.className = 'screen coll';
  const golds = STAMP_IDS.filter(id => stamps.has(id) && isGold(id)).length;
  r.appendChild(h('div', 'rbox', `<p class="eyebrow">Your collection</p><div class="gname" style="color:var(--light)">${stamps.size} OF 5 CARDS</div>${golds ? `<p class="goldline" style="color:#F2C94C">${golds} golden</p>` : ''}`));
  const grid = h('div', 'collgrid'); r.appendChild(grid);
  STAMP_IDS.forEach(id => {
    if (stamps.has(id)) grid.appendChild(holoCard(id, cardStars(id), isGold(id)));
    else grid.appendChild(h('div', 'holo locked', `<div class="holo-in"><span>?</span><b>${HOLO[id].file}</b></div>`));
  });
  const w = h('div', 'rbtns');
  if (stamps.size) { const sv2 = h('button', 'btn', 'Save my collection'); sv2.onclick = () => { sfx.tap(); saveCollection(sv2); }; w.appendChild(sv2); }
  const b = h('button', 'btn light', 'Close'); b.onclick = () => { r.hidden = true; }; w.appendChild(b); r.appendChild(w);
}
async function saveCollection(btn) {
  btn.textContent = 'Making your image…';
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  arcadeBG(c, 0); c.fillStyle = COL.ink; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(61,107,255,.12)'; c.lineWidth = 2; for (let x = 0; x <= W; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y <= H; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.textAlign = 'center'; c.font = `600 34px ${F.m}`; c.fillStyle = COL.p40; c.fillText('LEVEL 5 · BLK S · AR', W / 2, 150);
  glow(c, NEON, 40); c.font = `700 120px ${F.d}`; c.fillStyle = COL.light; c.fillText(`${stamps.size} OF 5 CARDS`, W / 2, 280); noGlow(c);
  const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.src = src; });
  const cw = 300, chh = 420, pos = [[60, 380], [390, 380], [720, 380], [225, 880], [555, 880]];
  for (let k = 0; k < STAMP_IDS.length; k++) {
    const id = STAMP_IDS[k], [x, y] = pos[k];
    if (stamps.has(id)) { const im = await load(holoArt(id, cardStars(id), isGold(id))); c.save(); glow(c, isGold(id) ? '#F2C94C' : NEON, 40); c.drawImage(im, x, y, cw, chh); c.restore(); }
    else { c.fillStyle = '#1E2229'; rr(c, x, y, cw, chh, 20); c.fill(); c.setLineDash([14, 10]); c.strokeStyle = '#545A65'; c.lineWidth = 4; c.stroke(); c.setLineDash([]); c.font = `700 110px ${F.d}`; c.fillStyle = '#545A65'; c.fillText('?', x + cw / 2, y + chh / 2 + 36); }
  }
  const golds = STAMP_IDS.filter(id => stamps.has(id) && isGold(id)).length;
  if (golds) { c.font = `700 56px ${F.d}`; c.fillStyle = '#F2C94C'; c.fillText(`${golds} GOLDEN`, W / 2, 1420); }
  c.font = `600 34px ${F.m}`; c.fillStyle = COL.p40; c.fillText('Scan the wall on Level 5 to collect yours', W / 2, 1560);
  c.font = `600 30px ${F.m}`; c.fillStyle = COL.p60; c.fillText('Diploma in Cloud Engineering · NYP', W / 2, H - 60);
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  const file = new File([blob], 'level5-collection.png', { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'My Level 5 collection' }); btn.textContent = 'Saved'; return; }
  } catch (e) { if (e && e.name === 'AbortError') { btn.textContent = 'Save my collection'; return; } }
  const url = URL.createObjectURL(blob), aEl = document.createElement('a'); aEl.href = url; aEl.download = 'level5-collection.png'; document.body.appendChild(aEl); aEl.click(); aEl.remove();
  btn.textContent = 'Saved (or screenshot this screen)';
}

/* =====================================================================
   CARD 0 · broke.py · "CAUGHT?"  reaction quiz, endless, harder expressions as you go
   ===================================================================== */
const CARDS = [];
const EXPR = [
  [['True', 1], ['False', 0]],
  [['not True', 0], ['not False', 1], ['True', 1], ['False', 0]],
  [['True and False', 0], ['True or False', 1], ['False or False', 0], ['True and True', 1], ['not False', 1]],
  [['7 > 3', 1], ['1 == 2', 0], ['5 >= 5', 1], ['not (1 == 2)', 1], ['3 != 3', 0], ['"" == ""', 1], ['len("netflix") == 7', 1], ['2 + 2 == 5', 0]],
];
CARDS[0] = {
  file: 'broke.py', concept: 'if / else', stamp: 'broke', dark: true,
  game: 'CAUGHT?', tagline: 'Each round the check returns something new. <b>Tap the line that runs</b> before time’s up. It gets harder fast.',
  stars: [1500, 5000, 10000],
  init(v) { v.fx = makeFX(); v.s = { phase: 'intro', score: 0, combo: 0, lives: 3, n: 0, right: 0, coins: 0, flip: 0 }; },
  start(v) { v.tr.hl(3); gameIntro(v, this); if (!seenHow(this.stamp)) showHow(this.stamp); },
  play(v) {
    Object.assign(v.s, { phase: 'q', score: 0, combo: 0, lives: 3, n: 0, right: 0, coins: 0 }); v.clearOut(); v.tr.reset();
    v.ui.clear(); v.ui.prompt.className = 'prompt'; v.ui.prompt.innerHTML = ''; v.ui.row(true);
    const a = v.ui.choice(4, 'CAUGHT', 'True · line 4 runs', () => this.answer(v, 4)), b = v.ui.choice(6, 'SAFE', 'False · line 6 runs', () => this.answer(v, 6));
    a.classList.add('big'); b.classList.add('big'); v.btns = [a, b];
    v.tr.tappable([4, 6], n => this.answer(v, n));
    this.next(v);
  },
  next(v) {
    const s = v.s, real = s.n - 2, tier = real < 0 ? 0 : Math.min(EXPR.length - 1, Math.floor(Math.max(0, s.right - 2) / 4)), pool = EXPR[tier];
    let e; if (s.n === 0) e = ['True', 1]; else if (s.n === 1) e = ['False', 0];
    else do { e = pool[(Math.random() * pool.length) | 0]; } while (s.expr && e[0] === s.expr && pool.length > 1);
    s.expr = e[0]; s.val = !!e[1]; s.tier = tier; s.flip = 0; s.phase = 'q'; s.practice = s.n < 2;
    s.tMax = s.practice ? 99 : Math.max(1.4, 7 * Math.pow(.9, real)); s.tLeft = s.tMax; s.n++;
    v.btns.forEach(b => b.classList.remove('guide', 'dim'));
    if (s.practice) { const want = s.val ? 0 : 1; v.btns[want].classList.add('guide'); v.btns[1 - want].classList.add('dim');
      v.ui.prompt.className = 'prompt guidep'; v.ui.prompt.innerHTML = `<p class="eyebrow">Practice ${s.n} of 2</p><p>The check came back <b>${s.expr}</b>. ${s.val ? '<b>True</b> means line 4 runs: tap <b>CAUGHT</b>.' : '<b>False</b> means the <b>else</b> runs, line 6: tap <b>SAFE</b>.'}</p>`; }
    else if (s.n === 3) { v.ui.prompt.className = 'prompt guidep'; v.ui.prompt.innerHTML = `<p class="eyebrow">Your turn</p><p>Now the timer’s on. It speeds up as you go.</p>`; setTimeout(() => { if (v.s.n === 3) v.ui.prompt.innerHTML = ''; }, 2500); }
    v.tr.clearChips(); v.tr.hl(3); sfx.step();
    v.btns.forEach(b => b.classList.remove('right', 'wrong'));
  },
  answer(v, line) {
    const s = v.s; if (s.phase !== 'q') return;
    const correct = s.val ? 4 : 6, ok = line === correct; s.phase = 'reveal'; s.revealT = 0; s.ok = ok;
    v.tr.chip(3, s.val ? 'True' : 'False'); v.tr.hl(correct);
    v.btns.forEach(b => { const n = +b.querySelector('.n').textContent; if (n === correct) b.classList.add('right'); else if (n === line) b.classList.add('wrong'); });
    if (ok) {
      s.combo++; s.right++; const pts = s.practice ? 50 : Math.round((100 + 150 * (s.tLeft / s.tMax)) * Math.min(3, 1 + (s.combo - 1) * .25) * (1 + s.tier * .25)); s.score += pts;
      v.fx.pop(500, 200, '+' + pts, COL.light, 64); v.fx.burst(500, 240, 26, [COL.light, NEON, COL.p40], 620, 12); v.fx.ring(500, 240);
      if (s.combo % 5 === 0) { v.fx.pop(500, 120, `${s.combo} IN A ROW!`, COL.p40, 50); sfx.win(); } else sfx.ok();
      s.coins = 1; v.out(s.val ? 'BrokeError: Goodbye, food budget.' : 'Still on my friend\'s account.', s.val ? 'err' : null);
    } else {
      if (!s.practice) s.lives--; s.combo = 0; v.fx.hit(1); v.fx.flashIt(COL.primary, 1); sfx.err(); v.fx.pop(500, 200, line ? 'WRONG LINE' : 'TOO SLOW', COL.p40, 56);
      v.out(`${s.expr} is ${s.val}, so line ${correct} runs`, 'sys');
    }
  },
  update(v, dt) {
    const s = v.s, k = dt / 1000; v.fx.update(dt); s.flip = Math.min(1, s.flip + k * 4);
    if (s.phase === 'q' && !s.practice) { s.tLeft -= k; if (s.tLeft <= 0) { s.tLeft = 0; this.answer(v, 0); } }
    if (s.phase === 'reveal') { s.revealT += k; if (s.revealT > (s.practice ? 1.3 : s.ok ? .55 : 1.4)) { if (s.lives <= 0) this.over(v); else this.next(v); } }
  },
  over(v) {
    const s = v.s; s.phase = 'over'; v.tr.tappable(); v.ui.clear(); v.ui.row(false); v.ui.prompt.innerHTML = '';
    setTimeout(() => { gameIntro(v, this); showResults(v, this, s.score, [`${s.right} right`, `reached level ${s.tier + 1} of 4`]); }, 500);
  },
  draw(v, c) {
    const s = v.s; arcadeBG(c, v.t); c.save(); v.fx.pre(c); c.translate(0, v.oy);
    if (s.phase === 'intro' || s.phase === 'over') {
      const bob = Math.sin(v.t * 2) * 8;
      glow(c, NEON, 40); txt(c, 'CAUGHT?', 500, 250 + bob, `700 150px ${F.d}`, COL.light, 'center', 'middle'); noGlow(c);
      txt(c, 'password_sharing_detected()', 500, 360, `600 30px ${F.m}`, COL.p60, 'center');
      const pulse = .5 + .5 * Math.sin(v.t * 4); c.globalAlpha = .4 + .6 * pulse; txt(c, '▶  PRESS PLAY', 500, 450, `700 34px ${F.d}`, COL.p40, 'center'); c.globalAlpha = 1;
    } else {
      hudScore(c, s.score, s.combo); hudLives(c, s.lives);
      // expression card flips in
      const f = back(s.flip), w = 640, hh = 170, x = 180, y = 150;
      c.save(); c.translate(500, y + hh / 2); c.scale(1, Math.max(.02, f)); c.translate(-500, -(y + hh / 2));
      glow(c, NEON, s.phase === 'reveal' ? 50 : 26); fillRR(c, x, y, w, hh, 26, '#101935'); noGlow(c); strokeRR(c, x, y, w, hh, 26, NEON, 5);
      txt(c, 'the check returns', 500, y + 44, `600 24px ${F.m}`, COL.p60, 'center');
      const big = s.expr.length > 12 ? 52 : 74; glow(c, NEON, 20); txt(c, s.expr, 500, y + 120, `700 ${big}px ${F.m}`, COL.light, 'center'); noGlow(c);
      if (s.phase === 'reveal') { const tag = s.val ? 'True' : 'False'; fillRR(c, 820 - 150, y - 26, 150, 52, 26, s.val ? COL.primary : COL.furniture); txt(c, tag, 820 - 75, y + 10, `700 32px ${F.m}`, COL.light, 'center'); }
      c.restore();
      // timer bar
      if (s.practice) { glow(c, NEON, 16); txt(c, 'PRACTICE · NO TIMER', 500, 366, `700 30px ${F.d}`, COL.p40, 'center'); noGlow(c); }
      const tb = s.practice ? 0 : s.tLeft / s.tMax; if (!s.practice) fillRR(c, 180, 350, 640, 18, 9, 'rgba(248,249,251,.1)'); if (tb > 0) { glow(c, NEON, 18); fillRR(c, 180, 350, Math.max(18, 640 * tb), 18, 9, tb < .3 ? COL.light : NEON); noGlow(c); }
      // level dots
      for (let i = 0; i < 4; i++) { circle(c, 446 + i * 36, 410, 9, i <= s.tier ? NEON : 'rgba(248,249,251,.15)'); }
      txt(c, ['LEVEL 1 · TRUE / FALSE', 'LEVEL 2 · NOT', 'LEVEL 3 · AND / OR', 'LEVEL 4 · COMPARISONS'][s.tier || 0], 500, 460, `600 24px ${F.m}`, COL.p60, 'center');
      txt(c, 'True → CAUGHT (line 4)   ·   False → SAFE (line 6)', 500, 505, `600 24px ${F.m}`, 'rgba(248,249,251,.55)', 'center');
      if (s.phase === 'reveal' && !s.ok) { c.globalAlpha = clamp(1 - s.revealT, 0, 1); glow(c, NEON, 30); txt(c, s.val ? 'SHARING DETECTED' : 'YOU WERE SAFE', 500, 530, `700 44px ${F.d}`, COL.light, 'center'); noGlow(c); c.globalAlpha = 1; }
    }
    v.fx.draw(c); c.restore();
  },
};

/* =====================================================================
   CARD 1 · procrastination.py · "BREAK THE LOOP"  timing: hit BREAK as the loop passes line 8
   ===================================================================== */
const LOOP_NODES = [3, 4, 5, 6, 7, 8];
CARDS[1] = {
  file: 'procrastination.py', concept: 'while loop', stamp: 'procrastination', dark: true,
  game: 'BREAK THE LOOP', tagline: '<code>while True</code> spins forever. Hit <b>BREAK</b> as it passes <b>line 8</b>. It speeds up every time.',
  stars: [5000, 12000, 25000],
  init(v) { v.fx = makeFX(); v.s = { phase: 'intro', a: 0, speed: 1, level: 1, score: 0, lives: 3, checks: 0, combo: 0, shards: [] }; },
  start(v) { gameIntro(v, this); if (!seenHow(this.stamp)) showHow(this.stamp); },
  play(v) {
    Object.assign(v.s, { phase: 'run', a: -Math.PI / 2, speed: 1, level: 1, score: 0, lives: 3, checks: 0, combo: 0, laps: 0, shards: [], form: 0 }); v.clearOut(); v.tr.reset();
    v.ui.clear(); v.ui.prompt.className = 'prompt'; v.ui.prompt.innerHTML = '';
    const b = v.ui.button('BREAK', () => this.hit(v), 'breakbtn'); b.addEventListener('pointerdown', e => { e.preventDefault(); this.hit(v); }); b.onclick = null;
  },
  nodeAngle(i) { return -Math.PI / 2 + i * Math.PI * 2 / 6; },
  current(s) { const step = Math.PI * 2 / 6; let rel = ((s.a + Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); return { idx: Math.round(rel / step) % 6, off: (rel / step) - Math.round(rel / step) }; },
  hit(v) {
    const s = v.s; if (s.phase !== 'run' || s.form < 1) return;
    const { idx, off } = this.current(s), node = LOOP_NODES[idx];
    if (node === 8 && Math.abs(off) < .42) {
      const perfect = Math.abs(off) < .16; s.combo++;
      const pts = Math.round((perfect ? 300 : 150) * s.level * (1 + (s.combo - 1) * .2)); s.score += pts;
      v.fx.pop(500, 120, perfect ? 'PERFECT' : 'GOOD', COL.light, perfect ? 80 : 60); v.fx.pop(500, 200, '+' + pts, COL.p40, 48);
      v.fx.flashIt(COL.light, perfect ? 1 : .6); v.fx.hit(.6); perfect ? sfx.win() : sfx.ok();
      // shatter the ring
      for (let i = 0; i < 40; i++) { const a = rand(0, Math.PI * 2); s.shards.push({ x: 500 + Math.cos(a) * 170, y: 300 + Math.sin(a) * 170, vx: Math.cos(a) * rand(200, 700), vy: Math.sin(a) * rand(200, 700), r: rand(0, 6), vr: rand(-12, 12), t: 0, w: rand(14, 34) }); }
      v.fx.burst(500, 300, 40, [COL.light, NEON, COL.p40], 900, 12, 300);
      v.tr.insert(8, 'break', 8); v.out(`break · loop ${s.level} ended after ${s.checks} phone checks`, 'ok');
      s.phase = 'broken'; s.bt = 0;
    } else {
      s.lives--; s.combo = 0; v.fx.hit(1); v.fx.flashIt(COL.primary, 1); sfx.err();
      const why = node < 6 ? 'TOO EARLY' : node === 3 ? 'TOO LATE' : 'NOT YET';
      v.fx.pop(500, 140, why, COL.p40, 60); v.out(node <= 5 ? `break on line ${node}? study() hasn't even failed yet` : `line ${node}: the except isn't finished`, 'sys');
      if (s.lives <= 0) this.over(v);
    }
  },
  over(v) { const s = v.s; s.phase = 'over'; v.ui.clear(); setTimeout(() => { gameIntro(v, this); showResults(v, this, s.score, [`${s.level - 1} loops broken`, `top speed ×${s.speed.toFixed(1)}`]); }, 600); },
  update(v, dt) {
    const s = v.s, k = dt / 1000; v.fx.update(dt);
    s.shards.forEach(p => { p.t += k; p.x += p.vx * k; p.y += p.vy * k; p.vy += 500 * k; p.r += p.vr * k; }); s.shards = s.shards.filter(p => p.t < 1.2);
    if (s.phase === 'run') {
      s.form = Math.min(1, s.form + k * 2.5);
      const prev = this.current(s).idx; s.a += k * (1.9 * s.speed);
      const cur = this.current(s).idx; if (cur !== prev) { v.tr.hl(LOOP_NODES[cur]); sfx.step(); if (LOOP_NODES[cur] === 3 && s.form >= 1) { s.checks++; s.laps++; v.out(`Phone check no. ${46 + s.checks}`); sfx.ping(); if (s.laps % 3 === 0) { s.lives--; v.fx.hit(.5); v.fx.pop(500, 140, 'PHONE WINS', COL.p40, 52); if (s.lives <= 0) this.over(v); } } }
    }
    if (s.phase === 'broken') { s.bt += k; if (s.bt > 1.1) { s.level++; s.speed *= 1.17; s.phase = 'run'; s.form = 0; s.checks = 0; s.laps = 0; s.a = -Math.PI / 2; v.tr.insert(null); } }
  },
  draw(v, c) {
    const s = v.s; arcadeBG(c, v.t); c.save(); v.fx.pre(c); c.translate(0, v.oy);
    const cx = 500, cy = 300, R = 190;
    if (s.phase === 'intro' || s.phase === 'over') {
      const a = v.t * 2;
      glow(c, NEON, 30); c.lineWidth = 14; c.strokeStyle = NEON; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      circle(c, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 22, COL.light); noGlow(c);
      glow(c, NEON, 40); txt(c, 'BREAK', cx, cy - 10, `700 92px ${F.d}`, COL.light, 'center', 'middle'); txt(c, 'THE LOOP', cx, cy + 66, `700 54px ${F.d}`, COL.p40, 'center', 'middle'); noGlow(c);
    } else {
      hudScore(c, s.score, s.combo); hudLives(c, s.lives);
      txt(c, `LOOP ${s.level}`, 964, 124 - v.oy, `700 40px ${F.d}`, COL.light, 'right'); txt(c, `speed ×${s.speed.toFixed(1)}`, 964, 156 - v.oy, `600 22px ${F.m}`, COL.p60, 'right');
      txt(c, 'PHONE CHECKS', 964, 470, `600 20px ${F.m}`, COL.p60, 'right'); txt(c, String(s.checks), 964, 530, `700 60px ${F.d}`, s.checks ? COL.light : COL.g60, 'right');
      if (s.phase === 'run') {
        const f = easeOut(s.form), r = R * f;
        // break zone around node 8
        const za = this.nodeAngle(5), zw = Math.PI * 2 / 6 * .42;
        glow(c, COL.light, 30); c.lineWidth = 44; c.strokeStyle = 'rgba(248,249,251,.18)'; c.beginPath(); c.arc(cx, cy, r, za - zw, za + zw); c.stroke(); noGlow(c);
        c.lineWidth = 6; c.strokeStyle = 'rgba(248,249,251,.6)'; c.setLineDash([10, 10]); c.beginPath(); c.arc(cx, cy, r + 34, za - zw, za + zw); c.stroke(); c.setLineDash([]);
        glow(c, NEON, 24); c.lineWidth = 12; c.strokeStyle = NEON; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2 * f); c.stroke(); noGlow(c);
        LOOP_NODES.forEach((n, i) => { const a = this.nodeAngle(i), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, isB = n === 8;
          circle(c, x, y, isB ? 34 : 28, COL.ink); ring(c, x, y, isB ? 34 : 28, isB ? COL.light : NEON, 6); txt(c, String(n), x, y + 1, `600 ${isB ? 30 : 26}px ${F.m}`, COL.light, 'center', 'middle'); });
        txt(c, 'BREAK HERE', cx + Math.cos(za) * (r + 90) - 60, cy + Math.sin(za) * (r + 90) - 20, `700 26px ${F.d}`, COL.light, 'center');
        // comet + trail
        if (s.form >= 1) { for (let i = 14; i >= 0; i--) { const a = s.a - i * .06, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; c.globalAlpha = (1 - i / 15) * .8; glow(c, NEON, 20); circle(c, x, y, 20 - i, i === 0 ? COL.light : NEON); } c.globalAlpha = 1; noGlow(c); }
        txt(c, 'while True:', cx, cy + 10, `600 34px ${F.m}`, COL.p60, 'center', 'middle');
      }
      s.shards.forEach(p => { c.save(); c.globalAlpha = clamp(1 - p.t / 1.2, 0, 1); c.translate(p.x, p.y); c.rotate(p.r); glow(c, NEON, 14); c.fillStyle = p.t < .1 ? COL.light : NEON; c.fillRect(-p.w / 2, -5, p.w, 10); c.restore(); }); c.globalAlpha = 1; noGlow(c);
      if (s.phase === 'broken') { const q = back(clamp(s.bt * 3, 0, 1)); c.save(); c.translate(cx, cy); c.scale(q, q); glow(c, NEON, 40); txt(c, 'LOOP', 0, -30, `700 90px ${F.d}`, COL.light, 'center', 'middle'); txt(c, 'BROKEN', 0, 50, `700 90px ${F.d}`, COL.light, 'center', 'middle'); c.restore(); noGlow(c); }
    }
    v.fx.draw(c); c.restore();
  },
};

/* =====================================================================
   CARD 2 · deadline.py · "CRACK THE DEADLINE"  combination lock: flick 2 wheels to match the week
   ===================================================================== */
const OPS = ['==', '!=', '<', '<=', '>', '>='];
let wheelMoved = 0;
const LOCK_IN = .7;           // seconds you must sit on the right answer (stops spinning through every option)
const opTest = (op, d, n) => ({ '==': d === n, '!=': d !== n, '<': d < n, '<=': d <= n, '>': d > n, '>=': d >= n })[op];
const weekOf = (op, n) => [7, 6, 5, 4, 3, 2, 1].map(d => d === 7 ? 'C' : opTest(op, d, n) ? 'P' : 'N').join('');
function describeWeek(w) {
  const p = [6, 5, 4, 3, 2, 1].filter((d, i) => w[i + 1] === 'P');
  if (!p.length) return 'Never panic. Bold.';
  if (p.length === 6) return 'Panic every single day';
  const run = p.every((d, i) => i === 0 || p[i - 1] === d + 1);
  if (p.length === 1) return p[0] === 1 ? 'Panic only on the last day' : `Panic only with ${p[0]} days left`;
  if (run && p[p.length - 1] === 1) return `Start panicking with ${p[0]} days left`;
  if (run && p[0] === 6) return p[p.length - 1] === 2 ? 'Panic all week, give up on the last day' : `Panic early, give up with ${p[p.length - 1] - 1} days left`;
  if (p.length === 5) { const miss = [6, 5, 4, 3, 2, 1].find(d => !p.includes(d)); return `Panic every day except ${miss} days left`; }
  return 'Match this week';
}
CARDS[2] = {
  file: 'deadline.py', concept: 'if / elif', stamp: 'deadline', dark: true,
  game: 'CRACK THE DEADLINE', tagline: 'Line 4 is a lock. <b>Flick the two wheels</b> until your week matches the goal. 45 seconds, go.',
  stars: [500, 1300, 2400],
  init(v) { v.fx = makeFX(); v.s = { phase: 'intro', op: '==', n: 1, week: weekOf('==', 1), shown: weekOf('==', 1), flips: Array(7).fill(1), time: 45, score: 0, solved: 0, goal: null }; },
  start(v) { gameIntro(v, this); if (!seenHow(this.stamp)) showHow(this.stamp); },
  play(v) {
    Object.assign(v.s, { phase: 'run', time: 45, score: 0, solved: 0, roundT: 0, tutorial: !seenHow('deadline-tut') }); v.clearOut(); v.tr.reset();
    v.ui.clear(); v.ui.prompt.className = 'prompt'; v.ui.prompt.innerHTML = '';
    const lock = h('div', 'lock'); lock.innerHTML = `<span class="kw">elif</span><span class="lv">days_left</span>`;
    const w1 = this.wheel(OPS, OPS.indexOf(v.s.op), i => this.set(v, OPS[i], v.s.n)); const w2 = this.wheel([0, 1, 2, 3, 4, 5, 6, 7], v.s.n, i => this.set(v, v.s.op, i));
    lock.append(w1, w2, Object.assign(h('span', 'lv'), { textContent: ':' })); v.ui.el.appendChild(lock);
    this.newGoal(v); this.set(v, v.s.op, v.s.n, true);
  },
  wheel(items, start, cb) {
    const w = h('div', 'wheel'), list = h('div', 'wlist'); w.appendChild(list);
    list.appendChild(h('div', 'wpad')); items.forEach(it => list.appendChild(h('div', 'witem', String(it)))); list.appendChild(h('div', 'wpad'));
    let cur = start; const IH = 52;
    requestAnimationFrame(() => { list.scrollTop = start * IH; mark(); });
    function mark() { [...list.querySelectorAll('.witem')].forEach((e, i) => e.classList.toggle('on', i === cur)); }
    list.addEventListener('scroll', () => { wheelMoved = performance.now(); const i = clamp(Math.round(list.scrollTop / IH), 0, items.length - 1); if (i !== cur) { cur = i; mark(); blip(1500, .012, 'square', .02); buzz(5); cb(i); } }, { passive: true });
    return w;
  },
  newGoal(v) {
    const s = v.s; let op, n, w, tries = 0; s.match = false; s.lockT = 0;
    if (s.tutorial) { s.goal = { w: weekOf('<=', 3), text: 'Start panicking with 3 days left' }; s.roundT = 0; s.goalIn = 0; return; }
    do { op = OPS[(Math.random() * OPS.length) | 0]; n = (Math.random() * 8) | 0; w = weekOf(op, n); tries++; } while ((w === s.week || w === (s.goal && s.goal.w) || (describeWeek(w) === 'Match this week' && tries < 40)) && tries < 80);
    s.goal = { w, text: describeWeek(w) }; s.roundT = 0; s.goalIn = 0;
  },
  set(v, op, n, silent) {
    const s = v.s; s.op = op; s.n = n; const w = weekOf(op, n);
    for (let i = 0; i < 7; i++) if (w[i] !== s.week[i]) { s.flips[i] = 0; }
    s.week = w;
    v.tr.patch(4, [['elif', C.kw], [' days_left ', C.txt], [op, C.txt], [' ', C.txt], [String(n), C.str], [':', C.txt]], !silent);
    s.match = s.phase === 'run' && s.goal && w === s.goal.w; if (!s.match) s.lockT = 0;
  },
  solve(v) {
    const s = v.s; if (s.tutorial) { s.tutorial = false; HOW_SEEN.add('deadline-tut'); try { localStorage.setItem('l5ar-how', JSON.stringify([...HOW_SEEN])); } catch (e) {} s.time = 45; v.fx.pop(500, 230, 'NOW FOR REAL', COL.light, 64); v.fx.flashIt(COL.light, .6); sfx.win(); s.phase = 'cracked'; s.ct = 0; v.out('practice cracked. the clock is on', 'ok'); return; }
    s.solved++; const bonus = Math.max(0, Math.round(250 - s.roundT * 40)); const pts = 100 + bonus; s.score += pts; s.time += 4;
    v.fx.pop(500, 230, '+' + pts, COL.light, 70); v.fx.pop(500, 300, '+4s', COL.p40, 40); v.fx.burst(500, 440, 50, [COL.light, NEON, COL.p40], 760, 12); v.fx.ring(500, 440, COL.light, 30, 420); v.fx.flashIt(COL.light, .7);
    sfx.win(); buzz([15, 30, 15]); v.out(`cracked: elif days_left ${s.op} ${s.n}`, 'ok');
    s.phase = 'cracked'; s.ct = 0;
  },
  update(v, dt) {
    const s = v.s, k = dt / 1000; v.fx.update(dt); s.goalIn = Math.min(1, (s.goalIn || 0) + k * 3);
    for (let i = 0; i < 7; i++) if (s.flips[i] < 1) { const before = s.flips[i]; s.flips[i] = Math.min(1, s.flips[i] + k * (5 - i * .25)); if (before < .5 && s.flips[i] >= .5) blip(400 + i * 40, .02, 'square', .02); }
    if (s.phase === 'run' && s.match) { if (performance.now() - wheelMoved > 140) { s.lockT += k; if (s.lockT >= LOCK_IN) this.solve(v); } else s.lockT = 0; }
    if ((s.phase === 'run' || s.phase === 'cracked') && !s.tutorial) { s.time -= k; s.roundT += k; }
    if (s.phase === 'run' || s.phase === 'cracked') { if (s.time <= 0) { s.time = 0; s.phase = 'over'; v.ui.clear(); sfx.no(); setTimeout(() => { gameIntro(v, this); showResults(v, this, s.score, [`${s.solved} locks cracked`]); }, 500); } }
    if (s.phase === 'cracked') { s.ct += k; if (s.ct > .8) { s.phase = 'run'; this.newGoal(v); } }
  },
  draw(v, c) {
    const s = v.s; arcadeBG(c, v.t); c.save(); v.fx.pre(c); c.translate(0, v.oy);
    if (s.phase === 'intro' || s.phase === 'over') {
      glow(c, NEON, 40); txt(c, 'CRACK THE', 500, 200, `700 80px ${F.d}`, COL.light, 'center', 'middle'); txt(c, 'DEADLINE', 500, 290, `700 110px ${F.d}`, COL.p40, 'center', 'middle'); noGlow(c);
      for (let i = 0; i < 7; i++) this.tile(c, 108 + i * 116, 380, i, 'CPPNNNP'[i] || 'N', 1, 92);
    } else {
      hudScore(c, s.score, 0); const tt = Math.ceil(s.time); if (s.tutorial) { txt(c, 'PRACTICE', 964, 74 - v.oy, `700 44px ${F.d}`, COL.p40, 'right'); } else { glow(c, tt <= 10 ? COL.light : NEON, 20); txt(c, `0:${String(tt).padStart(2, '0')}`, 964, 74 - v.oy, `700 60px ${F.d}`, tt <= 10 && Math.floor(v.t * 4) % 2 ? COL.p40 : COL.light, 'right'); noGlow(c); }
      txt(c, `${s.solved} CRACKED`, 964, 108 - v.oy, `600 22px ${F.m}`, COL.p60, 'right');
      // goal
      const gi = back(s.goalIn); c.save(); c.translate(500, 196); c.scale(gi, gi);
      txt(c, 'GOAL', 0, -26, `600 22px ${F.m}`, COL.p60, 'center'); glow(c, NEON, 16); txt(c, s.goal.text, 0, 14, `700 40px ${F.b}`, COL.light, 'center'); noGlow(c); c.restore();
      for (let i = 0; i < 7; i++) this.tile(c, 116 + i * 110, 236, i, s.goal.w[i], 1, 60, true);
      // your week (split-flap)
      txt(c, 'YOUR WEEK', 36, 352, `600 22px ${F.m}`, COL.p60);
      for (let i = 0; i < 7; i++) this.tile(c, 116 + i * 110, 372, i, s.week[i], s.flips[i], 100, false, s.week[i] === s.goal.w[i]);
      if (s.match && s.phase === 'run') { const q = clamp(s.lockT / LOCK_IN, 0, 1); fillRR(c, 60, 490, 880, 16, 8, 'rgba(248,249,251,.12)'); glow(c, COL.light, 20); fillRR(c, 60, 490, Math.max(16, 880 * q), 16, 8, COL.light); noGlow(c); txt(c, 'MATCH · HOLD STILL TO LOCK IN', 500, 538, `700 30px ${F.d}`, COL.light, 'center'); }
      else if (s.tutorial) { glow(c, NEON, 16); txt(c, 'PRACTICE: set the left wheel to <=  and the right to 3', 500, 530, `600 26px ${F.m}`, COL.p40, 'center'); noGlow(c); }
      if (s.phase === 'cracked') { const q = back(clamp(s.ct * 4, 0, 1)); c.save(); c.translate(500, 420); c.scale(q, q); c.rotate(-.08); fillRR(c, -230, -54, 460, 108, 20, COL.light); glow(c, NEON, 30); txt(c, 'CRACKED', 0, 22, `700 80px ${F.d}`, COL.primary, 'center'); c.restore(); noGlow(c); }
    }
    v.fx.draw(c); c.restore();
  },
  tile(c, x, y, i, st, flip, size, ghost, match) {
    const day = 7 - i, w = size * .92, hh = size;
    const f = flip < .5 ? 1 - flip * 2 : (flip - .5) * 2;
    c.save(); c.translate(x, y + hh / 2); c.scale(1, Math.max(.04, f)); c.translate(-x, -(y + hh / 2));
    const fill = st === 'P' ? COL.primary : st === 'C' ? '#1C2B5E' : '#1E2229';
    if (!ghost && st === 'P') glow(c, NEON, 20);
    fillRR(c, x - w / 2, y, w, hh, 10, ghost ? 'rgba(248,249,251,.06)' : fill); noGlow(c);
    strokeRR(c, x - w / 2, y, w, hh, 10, ghost ? (st === 'P' ? NEON : 'rgba(248,249,251,.25)') : match ? COL.light : 'rgba(248,249,251,.18)', ghost ? 3 : match ? 4 : 2);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x - w / 2, y + hh / 2 - 1, w, 2);
    txt(c, String(day), x, y + hh * .42, `700 ${Math.round(size * .42)}px ${F.d}`, ghost && st !== 'P' ? COL.g60 : COL.light, 'center', 'middle');
    if (size >= 80) txt(c, st === 'P' ? 'panic' : st === 'C' ? 'chill' : 'zzz', x, y + hh * .82, `600 22px ${F.m}`, st === 'P' ? COL.sky : COL.g60, 'center', 'middle');
    else if (st === 'P') bolt(c, x, y + hh * .8, 1, COL.light);
    c.restore();
  },
};

/* =====================================================================
   CARD 3 · lecture.py · "DO NOT DISTURB"  hold to listen, swat notifications, chain combos
   ===================================================================== */
const APPS = [['group chat', 1], ['tiktok', 1], ['instagram', 1], ['youtube', 1], ['game invite', 1], ['MUM CALLING', 2], ['FOCUS MODE', 3], ['EXAM INFO', 4]];
// fixed rhythm so the same play gets the same score: which kind each notification is, in order
const NOTE_KIND = i => i % 9 === 8 ? 3 : i % 6 === 5 ? 2 : i % 7 === 3 ? 4 : 1;
CARDS[3] = {
  file: 'lecture.py', concept: 'try / except', stamp: 'lecture', dark: true,
  game: 'DO NOT DISTURB', tagline: '<b>Hold</b> to listen. <b>Swat</b> notifications with your other thumb. Never swat <b>EXAM INFO</b>. Survive 5:00.',
  stars: [1500, 3200, 5000],
  init(v) { v.fx = makeFX(); v.s = { phase: 'intro', att: 1, sec: 0, t: 0, notes: [], score: 0, combo: 0, lastSwat: 0, shield: 0, swats: 0 }; },
  start(v) { gameIntro(v, this); if (!seenHow(this.stamp)) showHow(this.stamp); },
  play(v) {
    const s = v.s; Object.assign(s, { phase: 'ready', att: 1, sec: 0, t: 0, notes: [], score: 0, combo: 0, lastSwat: 0, shield: 0, swats: 0, phoneT: 0, idx: 0, oops: 0 }); v.clearOut(); v.tr.reset(); v.tr.hl(4);
    v.ui.clear(); v.ui.prompt.className = 'prompt'; v.ui.prompt.innerHTML = '';
    const b = v.ui.button('<span>Hold to listen</span>', () => {}, 'hold'); const fill = h('i', 'fill'); b.prepend(fill); v.holdBtn = b; v.holdFill = fill;
    const down = e => { e.preventDefault(); audioInit(); b.classList.add('down'); if (s.phase === 'ready') { s.phase = 'listen'; s.nextNote = .6; sfx.step(); } };
    const up = () => { if (!b.classList.contains('down')) return; b.classList.remove('down'); if (s.phase === 'listen') this.fail(v, 'You let go.'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('contextmenu', e => e.preventDefault());
  },
  onStageTap(v, x, y) {
    const s = v.s; if (s.phase !== 'listen') return;
    for (let i = s.notes.length - 1; i >= 0; i--) {
      const n = s.notes[i];
      if (x > n.x - 24 && x < n.x + n.w + 24 && y > n.y - 24 && y < n.y + n.h + 24) {
        s.notes.splice(i, 1);
        if (n.kind === 4) { s.oops++; s.combo = 0; s.score = Math.max(0, s.score - 150); s.att = Math.max(0, s.att - .15); v.fx.hit(1); v.fx.flashIt(COL.primary, 1); v.fx.pop(n.x + n.w / 2, n.y, 'NOT THAT ONE  −150', COL.p40, 40); sfx.err(); v.out('you swatted the exam info. oops', 'sys'); return; }
        const now = s.t; s.combo = now - s.lastSwat < 1.2 ? Math.min(5, s.combo + 1) : 1; s.lastSwat = now; s.swats++;
        const base = n.kind === 2 ? 60 : n.kind === 3 ? 150 : 30, pts = base * s.combo; s.score += pts; s.att = Math.min(1, s.att + .05);
        const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        v.fx.burst(cx, cy, n.kind === 3 ? 50 : 18, n.kind === 3 ? [COL.light, NEON] : [NEON, COL.p40, COL.light], 560, 11); v.fx.pop(cx, cy - 20, '+' + pts, COL.light, 46); v.fx.ring(cx, cy, NEON, 20, 140);
        blip(700 + s.combo * 90, .05, 'square', .03); buzz(10);
        if (n.kind === 3) { s.shield = 1; s.notes.filter(o => o.kind !== 4).forEach(o => { v.fx.burst(o.x + o.w / 2, o.y + o.h / 2, 12, [COL.light, NEON], 400, 9); s.score += 60; }); s.notes = s.notes.filter(o => o.kind === 4); v.fx.flashIt(COL.light, .8); v.fx.pop(500, 120, 'FOCUS MODE', COL.light, 70); sfx.win(); }
        return;
      }
    }
  },
  fail(v, why) {
    const s = v.s; s.phase = 'except'; s.phoneT = 0; v.fx.hit(1); v.fx.flashIt(COL.primary, 1);
    if (v.holdBtn) v.holdBtn.disabled = true;
    v.run.run([{ chip: [4, 'Error'], out: 'AttentionSpanError', kind: 'err', wait: 500, sfx: 'err' }, { line: 5, wait: 350 }, { line: 6, wait: 300, fn: () => { s.phase = 'phone'; s.phoneT = 0; } }, { line: 7, wait: 1300, out: 'phone.open("instagram", "tiktok")' },
      { wait: 10, fn: () => { gameIntro(v, this); showResults(v, this, s.score, [why, `lasted ${fmt(s.sec)} of 5:00`, `${s.swats} swats`]); } }]);
  },
  win(v) {
    const s = v.s; s.phase = 'win'; s.t2 = 0; const attBonus = Math.round(s.att * 1500); s.score += 1000 + attBonus; v.tr.hl(null); v.tr.dimLines([5, 6, 7]); if (v.holdBtn) v.holdBtn.disabled = true;
    v.out('lecture finished, no exception raised', 'ok'); v.fx.pop(500, 260, `+${1000 + attBonus}`, COL.light, 80); confetti(true); sfx.win();
    setTimeout(() => { gameIntro(v, this); showResults(v, this, s.score, ['made it to 5:00', `attention bonus +${attBonus}`, `${s.swats} swats`, ...(s.oops ? [`${s.oops} exam info swatted`] : [])]); }, 1400);
  },
  update(v, dt) {
    const s = v.s, k = dt / 1000; v.fx.update(dt); s.t += k; s.phoneT += k;
    if (s.phase === 'listen') {
      s.sec += k * 12; s.shield = Math.max(0, s.shield - k);
      s.att -= k * (.02 + s.notes.reduce((a2, n) => a2 + (n.kind === 2 ? .2 : n.kind >= 3 ? 0 : .09), 0));
      s.nextNote -= k;
      if (s.nextNote <= 0 && s.shield <= 0) {
        const kind = NOTE_KIND(s.idx++), pool = APPS.filter(a2 => a2[1] === kind), app = pool[s.idx % pool.length][0];
        const w = kind === 2 ? 420 : 340, hh = kind === 2 ? 110 : 88;
        const yTop = 140 - v.oy, yBot = (v.DH || 560) - v.oy - hh - 24; let x, y, tries = 0; do { x = rand(30, 1000 - w - 30); y = rand(yTop, Math.max(yTop + 10, yBot)); tries++; } while (tries < 20 && s.notes.some(n => x < n.x + n.w + 10 && x + w + 10 > n.x && y < n.y + n.h + 10 && y + hh + 10 > n.y));
        s.notes.push({ x, y, w, h: hh, app, kind, t: 0 });
        s.nextNote = Math.max(.38, 1.0 - s.sec / 420); kind === 2 ? (blip(520, .2, 'sine', .05), blip(660, .2, 'sine', .05, .2)) : kind === 4 ? blip(300, .15, 'sine', .04) : sfx.ping();
      }
      s.notes.forEach(n => n.t += k); s.notes = s.notes.filter(n => (n.kind !== 3 || n.t < 2.2) && (n.kind !== 4 || n.t < 1.9));
      if (s.t - s.lastSwat > 1.2) s.combo = 0;
      if (v.holdFill) v.holdFill.style.width = (s.sec / 300 * 100) + '%';
      if (s.sec >= 300) { s.sec = 300; this.win(v); } else if (s.att <= 0) { s.att = 0; this.fail(v, 'You zoned out.'); }
    }
  },
  draw(v, c) {
    const s = v.s; arcadeBG(c, v.t); c.save(); v.fx.pre(c); c.translate(0, v.oy);
    if (s.phase === 'intro') {
      glow(c, NEON, 40); txt(c, 'DO NOT', 500, 210, `700 100px ${F.d}`, COL.light, 'center', 'middle'); txt(c, 'DISTURB', 500, 310, `700 120px ${F.d}`, COL.p40, 'center', 'middle'); noGlow(c);
      [[130, 90], [770, 120], [180, 430], [720, 440]].forEach(([x, y], i) => { const b = Math.sin(v.t * 3 + i) * 6; c.globalAlpha = .5; fillRR(c, x - 90, y - 26 + b, 180, 52, 16, '#1E2A55'); circle(c, x - 60, y + b, 12, NEON); c.globalAlpha = 1; });
    } else {
      hudScore(c, s.score, s.combo);
      txt(c, fmt(s.sec), 964, 74 - v.oy, `700 60px ${F.d}`, s.phase === 'win' ? COL.p40 : COL.light, 'right'); txt(c, 'OF 5:00', 964, 104 - v.oy, `600 20px ${F.m}`, COL.p60, 'right');
      // attention bar across the top
      const ax = 330, aw = 400, ay = 60 - v.oy; txt(c, 'ATTENTION', ax, ay - 14, `600 20px ${F.m}`, COL.p60); fillRR(c, ax, ay, aw, 26, 13, 'rgba(248,249,251,.1)');
      if (s.att > 0) { glow(c, s.att < .3 ? COL.light : NEON, 18); fillRR(c, ax, ay, Math.max(26, aw * s.att), 26, 13, s.att < .3 ? COL.light : NEON); noGlow(c); }
      if (s.shield > 0) { c.globalAlpha = Math.min(1, s.shield); glow(c, COL.light, 40); strokeRR(c, 10, 120 - v.oy, 980, (v.DH || 560) - 130, 30, COL.light, 6); noGlow(c); c.globalAlpha = 1; }
      if (s.phase === 'ready') { const p = .5 + .5 * Math.sin(v.t * 5); c.globalAlpha = .5 + .5 * p; glow(c, NEON, 30); txt(c, 'HOLD THE BUTTON', 500, 340, `700 64px ${F.d}`, COL.light, 'center', 'middle'); noGlow(c); c.globalAlpha = 1; }
      s.notes.forEach(n => {
        const k = back(clamp(n.t * 5, 0, 1)), wob = Math.sin(n.t * 22) * Math.max(0, .5 - n.t) * 5, mum = n.kind === 2, gold = n.kind === 3;
        c.save(); c.translate(n.x + n.w / 2 + wob, n.y + n.h / 2); c.scale(k, k); if (mum) c.rotate(Math.sin(n.t * 30) * .03); c.translate(-n.w / 2, -n.h / 2);
        const exam = n.kind === 4; if (exam) c.globalAlpha = clamp((1.9 - n.t) * 2, 0, 1);
        glow(c, gold ? COL.light : NEON, gold ? 40 : exam ? 0 : 22); fillRR(c, 0, 0, n.w, n.h, 22, gold ? COL.light : mum ? COL.primary : exam ? COL.ink : '#18234A'); noGlow(c);
        if (exam) { c.setLineDash([12, 8]); strokeRR(c, 0, 0, n.w, n.h, 22, COL.light, 4); c.setLineDash([]); txt(c, '!', 44, n.h / 2 + 14, `700 40px ${F.d}`, COL.light, 'center'); txt(c, 'EXAM INFO', 82, n.h / 2 - 2, `700 30px ${F.b}`, COL.light); txt(c, 'don’t swat', 82, n.h / 2 + 28, `600 22px ${F.m}`, COL.p40); c.restore(); c.globalAlpha = 1; return; }
        strokeRR(c, 0, 0, n.w, n.h, 22, gold ? NEON : COL.p40, 3);
        circle(c, 44, n.h / 2, 24, gold ? COL.primary : mum ? COL.light : NEON);
        txt(c, n.app, 82, n.h / 2 + 11, `700 ${mum ? 36 : 30}px ${F.b}`, gold ? COL.primary : COL.light);
        if (gold) { const g2 = 1 - (n.t / 2.2); fillRR(c, 16, n.h - 10, (n.w - 32) * g2, 5, 2, COL.primary); }
        c.restore();
      });
      if (s.phase === 'phone' || s.phase === 'except') {
        const kk = easeOut(Math.min(1, s.phoneT / .45)), y = lerp(620, 90, kk);
        glow(c, NEON, 40); fillRR(c, 360, y, 280, 420, 40, COL.ink); noGlow(c); strokeRR(c, 360, y, 280, 420, 40, NEON, 4);
        [['instagram', COL.primary], ['tiktok', COL.accent]].forEach(([nm, col], i) => { const x = 392 + i * 120, yy = y + 60, pop = back(clamp(s.phoneT * 3 - .4 - i * .2, 0, 1)); c.save(); c.translate(x + 48, yy + 48); c.scale(pop, pop); fillRR(c, -48, -48, 96, 96, 24, col); c.restore(); txt(c, nm, x + 48, yy + 130, `400 26px ${F.b}`, COL.soft, 'center'); });
        glow(c, NEON, 20); txt(c, 'except:', 500, y + 300, `700 44px ${F.m}`, COL.light, 'center'); noGlow(c);
      }
      if (s.phase === 'win') { const q = back(clamp(s.t * 2, 0, 1)); glow(c, NEON, 50); txt(c, 'NO EXCEPTION', 500, 330, `700 90px ${F.d}`, COL.light, 'center', 'middle'); noGlow(c); }
    }
    v.fx.draw(c); c.restore();
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
  const v = { target, ins: new Set(), angle: {}, turning: false, turnV: 0, jamT: 0, chal: 0, hint: 0, solved: new Set(), hl: new Set() };
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
    // controls (one mode: pick your challenge, copy your wall, hint / answer)
    board.style.aspectRatio = `${VB[2]} / ${VB[3]}`;
    const panel = h('div', 'panel'); body.append(panel); v.panel = panel;
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
  function renderPanel() {
    const p = v.panel; p.innerHTML = '';
    const chips = h('div', 'chips'); p.appendChild(chips);
    CHAL.forEach((c, i) => { const b = h('button', (i === v.chal ? 'on' : '') + (v.solved.has(c.id) ? ' solved' : ''), c.id); b.onclick = () => { sfx.tap(); v.chal = i; v.hint = 0; v.hl.clear(); sync(); }; chips.appendChild(b); });
    const c = CHAL[v.chal], g = c.goal;
    const tags = Object.entries(g).map(([k, d]) => k === 'F' ? `<span class="tag">F spins too</span>` : `<span class="tag">${ARROW(d === 1, COL.primary)}${k === 'OL' ? 'Left' : 'Right'} ${d === 1 ? 'clockwise' : 'anticlockwise'}</span>`).join('');
    p.appendChild(h('div', 'goal', `${tags}<span class="mono" style="font-size:14px;color:var(--g75)">${c.moves} move${c.moves > 1 ? 's' : ''}</span>`));
    const pr = h('div', 'prompt'); p.appendChild(pr);
    const prev = v.chal ? CHAL[v.chal - 1] : null, change = prev ? diff(prev.answer, c.answer) : diff([], c.answer), r = gearSpin(v.ins);
    if (r.jam) pr.innerHTML = `<p class="eyebrow">Jammed</p><p><b>${r.jam.map(x => LABEL[x]).join(', ')}</b> push against each other in a loop. Pull one of them out.</p>`;
    else if (goalOK(v.ins, g)) pr.innerHTML = `<p class="eyebrow">That works</p><p>Hold <b>Turn</b> to watch it, then do the same on the wall.</p>`;
    else if (v.hint === 0) pr.innerHTML = `<p class="eyebrow">Challenge ${c.id}</p><p><b>Copy your wall:</b> tap gears so this board matches yours, then hold <b>Turn</b> to test it.</p>`;
    else if (v.hint === 1) pr.innerHTML = `<p class="eyebrow">Hint</p><p>${prev ? `From the ${prev.id} answer, change` : 'Push in'} <b>${change.map(x => LABEL[x.g]).join(', ')}</b>. They’re circled.</p>`;
    else pr.innerHTML = `<p class="eyebrow">Answer</p><p>${change.map(x => `${x.in ? 'push in' : 'pull out'} <b>${LABEL[x.g]}</b>`).join(' · ')}. Lost? Pull everything out and push in <b>${c.fresh.map(x => LABEL[x]).join(', ')}</b>.</p>`;
    const hints = h('div', 'hints'); p.appendChild(hints);
    [['Hint', 1], ['Answer', 2]].forEach(([lab, lvl]) => {
      const b = h('button', 'btn ' + (v.hint >= lvl ? '' : 'light'), lab);
      b.onclick = () => { audioInit(); sfx.tap(); v.hint = Math.max(v.hint, lvl); v.hl = new Set(change.map(x => x.g)); if (lvl === 2) { v.ins = new Set(c.answer); sfx.clunk(); } sync(); checkSolved(); };
      hints.appendChild(b);
    });
    const row = h('div', 'ctrlrow'); p.appendChild(row); row.appendChild(turnButton());
    const clr = h('button', 'btn light', 'Reset'); clr.onclick = () => { v.ins.clear(); sfx.clunk(); sync(); }; row.appendChild(clr); clr.style.flex = '0 0 32%';
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
    const c = CHAL[v.chal];
    if (goalOK(v.ins, c.goal) && !v.solved.has(c.id)) { v.solved.add(c.id); v.celebrate = 2.2; sfx.win(); if (v.hint < 2) setTimeout(() => showGearWin(c, 3 - v.hint, v.solved), 1600); sync(); }
  }
  v.start = () => { if (!seenHow('gears')) showHow('gears'); };
  v.nextChallenge = () => { v.chal = Math.min(CHAL.length - 1, v.chal + 1); v.hint = 0; v.hl.clear(); sync(); };
  v.tick = (dt) => {
    const k = dt / 1000, r = gearSpin(v.ins);
    v.celebrate = Math.max(0, (v.celebrate || 0) - k);
    v.turnV = lerp(v.turnV, (v.turning || v.celebrate > 0) && !r.jam ? (v.celebrate > 0 ? 2.6 : 1) : 0, Math.min(1, k * 6));
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
    if (r.jam) {
      const pts = r.jam.map(g => [G[g].x, G[g].y]);
      sv('path', { d: 'M' + pts.map(p => p.join(',')).join(' L') + ' Z', fill: 'rgba(30,85,255,.25)', stroke: COL.light, 'stroke-width': 22, 'stroke-dasharray': '44 26', 'stroke-linejoin': 'round' }, fx);
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      sv('rect', { x: cx - 190, y: cy - 62, width: 380, height: 124, rx: 62, fill: COL.ink, stroke: COL.light, 'stroke-width': 10 }, fx);
      const t = sv('text', { x: cx, y: cy + 15, 'text-anchor': 'middle', 'font-family': F.d, 'font-weight': 700, 'font-size': 84, fill: COL.light }, fx); t.setAttribute('y', cy + 29); t.textContent = 'JAMMED';
    }
  };
  return v;
}
function showGearWin(ch, st) {
  const wasGold = isGold('gears');
  BEST.gears = Math.max(BEST.gears || 0, st); BEST.gearStars = BEST.gearStars || {}; BEST.gearStars[ch.id] = Math.max(BEST.gearStars[ch.id] || 0, st); saveBest();
  const newStamp = !stamps.has('gears'), newGold = !wasGold && isGold('gears');
  const r = $('results'); r.innerHTML = ''; r.hidden = false; r.className = 'screen';
  const box = h('div', 'rbox', `<p class="eyebrow">Challenge ${ch.id}</p><div class="rscore" style="font-size:72px">SOLVED</div>
    <div class="stars big">${[0, 1, 2].map(() => '<i></i>').join('')}</div>
    <div class="rbest">${st === 3 ? 'No hints. Big brain.' : st === 2 ? 'One nudge. Respect.' : 'Two hints. Still counts.'}</div>
    <div class="rlines"><span>now do it for real on the wall</span><span>${Object.values(BEST.gearStars || {}).filter(x => x >= 3).length} of 6 with no hints · all 6 = golden</span></div>`); r.appendChild(box);
  const holoSlot = h('div', 'holoslot'); r.appendChild(holoSlot);
  const btns = h('div', 'rbtns'); r.appendChild(btns);
  const b1 = h('button', 'btn', 'Next challenge'); b1.onclick = () => { r.hidden = true; if (maybeFinish()) return; if (view && view.nextChallenge) view.nextChallenge(); };
  const b2 = h('button', 'btn light', 'Scan something else'); b2.onclick = () => { r.hidden = true; leavePlay(); };
  btns.append(b1, b2); btns.style.opacity = 0;
  const stars = box.querySelectorAll('.stars i'); let i = 0;
  const next = () => { if (i < st) { stars[i].classList.add('on', 'slam'); blip(660 + i * 220, .14, 'triangle', .07); buzz(30); i++; setTimeout(next, 380); }
    else { confetti(st === 3); if (newStamp || newGold) { if (newStamp) award('gears', true); holoReveal(holoSlot, 'gears', st, newGold); setTimeout(() => btns.style.opacity = 1, 1900); } else btns.style.opacity = 1; } };
  setTimeout(next, 300);
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
$('goBtn').addEventListener('click', () => { askGyro(); startCamera(); });
$('browseBtn').addEventListener('click', () => { audioInit(); $('startTargets').scrollIntoView({ behavior: 'smooth' }); $('startTargets').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 500 }); });
$('rescan').addEventListener('click', () => { sfx.tap(); leavePlay(); });
$('camBack').addEventListener('click', () => { show('start'); updateCount(); renderStamps(); });
$('finishBack').addEventListener('click', () => leavePlay());
if (params.has('open')) openTarget(+params.get('open'), null);       // tests: jump straight into a card
if (params.has('autostart')) startCamera();
window.L5AR = { ar, stamps, CARDS, openTarget, gearSpin, showCollection, BEST, showResults, get view() { return view; }, crack() { const v = view, g = v.s.goal.w; for (const o of OPS) for (let n = 0; n < 8; n++) if (weekOf(o, n) === g) { CARDS[2].set(v, o, n); return o + n; } } };
