/* Level 5 AR: "run the code".
   Point at a code card -> a debugger bar steps through the REAL printed lines,
   True/False chips show each condition, and the program's window pops out above the card.
   One control per card. Built on MindAR (image tracking) + A-Frame. */
'use strict';

/* ---------- palette: the 7 colours + tints (same rules as the wall) ---------- */
const COL = {
  neutral:'#EEF0F2', primary:'#1E55FF', accent:'#1D47B8', ink:'#15181D', light:'#F8F9FB', furniture:'#3E4451', wall:'#2A2E37',
  p08:'#E7ECFB', p16:'#D5DFFC', p40:'#A1B7FD', p60:'#7597FD', g12:'#E2E3E7', g35:'#B7BAC0', g60:'#888C95', g75:'#6C717C',
  edge:'#545A65', soft:'#CACCD0', code:'#E1E2E5', hl:'#202328'
};
const F = { d:'Barlow, Arial Narrow, sans-serif', b:'Figtree, system-ui, sans-serif', m:"'Source Code Pro', Menlo, monospace" };

/* ---------- card geometry (from the print files, in card px) ---------- */
const CW = 640, CH = 412;                 // printed card is 640 x 412 mm
const LINE_Y = n => 89 + (n - 1) * 36;    // centre of code line n
const U = v => v / CW;                    // MindAR: target width = 1 unit
const PX = (x, y) => [U(x) - 0.5, U(CH / 2 - y)];

/* ---------- small helpers ---------- */
const $ = id => document.getElementById(id);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function fillRR(c, x, y, w, h, r, col) { rr(c, x, y, w, h, r); c.fillStyle = col; c.fill(); }
function txt(c, s, x, y, font, col, align = 'left', base = 'alphabetic') { c.font = font; c.fillStyle = col; c.textAlign = align; c.textBaseline = base; c.fillText(s, x, y); }
function circle(c, x, y, r, col) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = col; c.fill(); }
function wrap(c, s, x, y, maxW, lh) { const words = s.split(' '); let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); line = w; y += lh; } else line = t; } c.fillText(line, x, y); }

/* ---------- sound + buzz (tiny, optional; unlocked by the Start tap) ---------- */
let AC = null;
function audioInit() { if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
function blip(f, d = .06, type = 'triangle', vol = .05) {
  if (!AC) return; try { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, AC.currentTime); g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + d);
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + d); } catch (e) {}
}
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const sfx = {
  step: () => blip(880, .03, 'square', .015),
  tru: () => blip(1046, .09, 'triangle', .05),
  fal: () => blip(330, .09, 'triangle', .04),
  err: () => { blip(140, .22, 'sawtooth', .05); buzz(120); },
  win: () => [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, .16, 'triangle', .06), i * 90)),
  coin: () => blip(1568 + Math.random() * 300, .05, 'square', .02),
  ping: () => { blip(1318, .07, 'sine', .05); blip(1760, .09, 'sine', .04); },
  key: () => blip(2000 + Math.random() * 400, .015, 'square', .012),
};

/* ---------- canvas texture plane ---------- */
function canvasPlane(w, h, cw, ch) {
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace; else tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return { cv, ctx, tex, mat, mesh, w: cw, h: ch, dirty() { tex.needsUpdate = true; } };
}
function colorPlane(w, h, col, op) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: op, toneMapped: false, depthWrite: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

/* ---------- program runner: steps the debugger bar through the real lines ---------- */
function Runner(api) {
  let q = [], wait = 0;
  const exec = s => {
    if ('line' in s) api.hl(s.line);
    if (s.chip) api.chip(s.chip[0], s.chip[1]);
    if (s.out) api.out(s.out, s.kind);
    if (s.fn) s.fn();
    if (s.sfx) sfx[s.sfx]();
    else if ('line' in s && s.line) sfx.step();
  };
  return {
    run(steps) { q = steps.slice(); wait = 0; },
    push(...s) { q.push(...s); },
    clear() { q = []; wait = 0; },
    get busy() { return q.length > 0; },
    update(dt) { wait -= dt; while (wait <= 0 && q.length) { const s = q.shift(); exec(s); wait += (s.wait ?? 650); } },
  };
}

/* =====================================================================
   SCENES: the program's window, drawn on a 1024 x 600 canvas
   ===================================================================== */
const SW = 1024, SH = 600;
function windowChrome(c, title, right) {
  c.clearRect(0, 0, SW, SH);
  c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 14; c.shadowOffsetY = 6;
  fillRR(c, 18, 10, SW - 36, SH - 40, 30, COL.light); c.restore();
  c.save(); rr(c, 18, 10, SW - 36, SH - 40, 30); c.clip();
  c.fillStyle = COL.neutral; c.fillRect(18, 10, SW - 36, 62);
  c.fillStyle = COL.g12; c.fillRect(18, 71, SW - 36, 2);
  for (let k = 0; k < 3; k++) circle(c, 46 + k * 30, 40, 9, k === 0 ? COL.primary : COL.g35);
  // play triangle + title
  c.beginPath(); c.moveTo(150, 30); c.lineTo(166, 40); c.lineTo(150, 50); c.closePath(); c.fillStyle = COL.primary; c.fill();
  txt(c, title, 178, 50, `600 26px ${F.m}`, COL.ink);
  if (right) txt(c, right, SW - 40, 50, `600 24px ${F.m}`, COL.primary, 'right');
  return () => c.restore();
}
function caption(c, s) {
  c.fillStyle = COL.p08; c.fillRect(18, SH - 92, SW - 36, 62);
  txt(c, s, 44, SH - 52, `400 24px ${F.m}`, COL.furniture);
}
function bubble(c, x, y, w, s, tail = 'left') {
  c.font = `700 30px ${F.b}`; const tw = Math.min(w, c.measureText(s).width + 48);
  fillRR(c, x, y, tw, 70, 22, COL.light); rr(c, x, y, tw, 70, 22); c.lineWidth = 4; c.strokeStyle = COL.ink; c.stroke();
  const tx = tail === 'left' ? x + 40 : x + tw - 60;
  c.beginPath(); c.moveTo(tx, y + 68); c.lineTo(tx + 6, y + 96); c.lineTo(tx + 28, y + 68); c.closePath(); c.fillStyle = COL.light; c.fill();
  c.beginPath(); c.moveTo(tx, y + 70); c.lineTo(tx + 6, y + 96); c.lineTo(tx + 28, y + 70); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
  txt(c, s, x + 24, y + 46, `700 30px ${F.b}`, COL.ink);
}
function head(c, x, y, r, opt = {}) {
  circle(c, x, y, r, COL.neutral); c.lineWidth = 4; c.strokeStyle = COL.ink; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  // hair
  c.beginPath(); c.arc(x, y, r, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(x + r * .2, y - r * .45); c.closePath(); c.fillStyle = COL.ink; c.fill();
  if (opt.sleep) { c.lineWidth = 4; c.beginPath(); c.moveTo(x - r * .5, y + 4); c.lineTo(x - r * .15, y + 4); c.moveTo(x + r * .15, y + 4); c.lineTo(x + r * .5, y + 4); c.stroke(); }
  else if (opt.wide) { circle(c, x - r * .35, y + 2, 7, COL.ink); circle(c, x + r * .35, y + 2, 7, COL.ink); }
  else { circle(c, x - r * .35, y + 4, 5, COL.ink); circle(c, x + r * .35, y + 4, 5, COL.ink); }
}
function bolt(c, x, y, s, col) { c.beginPath(); c.moveTo(x + 2 * s, y - 10 * s); c.lineTo(x - 5 * s, y + 2 * s); c.lineTo(x, y + 2 * s); c.lineTo(x - 2 * s, y + 10 * s); c.lineTo(x + 5 * s, y - 2 * s); c.lineTo(x, y - 2 * s); c.closePath(); c.fillStyle = col; c.fill(); }

/* =====================================================================
   THE FOUR CARDS
   ===================================================================== */
const CARDS = [];

/* ---------- 0 · broke.py · if / else ---------- */
CARDS[0] = {
  file: 'broke.py', concept: 'if / else',
  how: 'Flip the switch. <b>if</b> it’s True, line 4 runs. <b>else</b>, line 6 runs. Never both.',
  init(api) { this.s = { det: false, phase: 'idle', budget: 1, coins: [], t: 0, flash: 0 }; },
  controls(api) {
    const b = document.createElement('button'); b.className = 'toggle'; b.setAttribute('aria-pressed', this.s.det);
    b.innerHTML = `<span class="lab">password_sharing_detected()<small>Netflix catches you sharing</small></span><span class="sw"></span>`;
    b.onclick = () => { this.s.det = !this.s.det; b.setAttribute('aria-pressed', this.s.det); this.play(api); };
    return [b];
  },
  onFound(api) { if (this.s.phase === 'idle') this.play(api); },
  play(api) {
    const s = this.s, det = s.det; api.clearChips(); api.dim(false);
    s.phase = 'run'; s.budget = 1; s.coins = []; s.t = 0;
    const steps = [{ line: 1, wait: 550 }, { line: 3, wait: 950, chip: [3, det ? 'True' : 'False'], sfx: det ? 'tru' : 'fal' }];
    if (det) steps.push({ line: 4, wait: 400, fn: () => { s.phase = 'caught'; s.t = 0; s.flash = 1; }, sfx: 'err' },
      { chip: [4, 'Error'], out: 'BrokeError: Goodbye, food budget.', kind: 'err', wait: 10 });
    else steps.push({ line: 5, wait: 550 }, { line: 6, wait: 400, out: 'Still on my friend\'s account.', fn: () => { s.phase = 'friend'; s.t = 0; }, sfx: 'win' });
    api.runner.run(steps);
  },
  update(api, dt) {
    const s = this.s; s.t += dt / 1000; s.flash = Math.max(0, s.flash - dt / 600);
    if (s.phase === 'caught') {
      s.budget = Math.max(0, 1 - s.t / 2.2);
      if (s.budget > 0 && Math.random() < .35) { s.coins.push({ x: 770 + Math.random() * 60, y: 300, vx: (Math.random() - .5) * 220, vy: -200 - Math.random() * 200 }); sfx.coin(); }
    }
    for (const k of s.coins) { k.vy += 900 * dt / 1000; k.x += k.vx * dt / 1000; k.y += k.vy * dt / 1000; }
    s.coins = s.coins.filter(k => k.y < 700);
  },
  draw(c) {
    const s = this.s;
    const done = windowChrome(c, 'broke.py', s.phase === 'caught' ? 'if → True' : s.phase === 'friend' ? 'else' : '');
    // TV
    fillRR(c, 60, 104, 520, 330, 18, COL.furniture); fillRR(c, 76, 120, 488, 298, 8, COL.ink);
    c.fillStyle = COL.furniture; c.fillRect(290, 434, 60, 26); fillRR(c, 230, 456, 180, 14, 7, COL.furniture);
    if (s.phase === 'caught') {
      const on = Math.floor(s.t * 6) % 2 === 0 || s.t > 1.4;
      if (on) { c.fillStyle = COL.primary; c.fillRect(76, 214, 488, 110); }
      circle(c, 132, 269, 30, COL.light); txt(c, '!', 132, 284, `700 42px ${F.d}`, COL.primary, 'center');
      txt(c, 'SHARING DETECTED', 180, 266, `700 38px ${F.d}`, COL.light);
      txt(c, 'This account is for your household only.', 180, 298, `400 19px ${F.b}`, COL.p16);
    } else if (s.phase === 'friend') {
      txt(c, 'Who’s watching?', 320, 180, `700 34px ${F.b}`, COL.light, 'center');
      const names = ['friend', 'friend’s mum', 'Kids'], cols = [COL.primary, COL.accent, COL.furniture];
      names.forEach((n, i) => {
        const x = 130 + i * 140, y = 214;
        fillRR(c, x, y, 100, 100, 14, cols[i]);
        circle(c, x + 34, y + 42, 6, COL.light); circle(c, x + 66, y + 42, 6, COL.light);
        c.beginPath(); c.arc(x + 50, y + 58, 18, .15 * Math.PI, .85 * Math.PI); c.strokeStyle = COL.light; c.lineWidth = 5; c.stroke();
        if (i === 0) { rr(c, x - 7, y - 7, 114, 114, 18); c.strokeStyle = COL.light; c.lineWidth = 5 + 2 * Math.sin(s.t * 6); c.stroke(); }
        txt(c, n, x + 50, y + 136, `400 20px ${F.b}`, COL.soft, 'center');
      });
    } else {
      c.beginPath(); c.moveTo(296, 222); c.lineTo(352, 269); c.lineTo(296, 316); c.closePath(); c.fillStyle = COL.edge; c.fill();
    }
    // wallet
    const open = s.phase === 'caught';
    fillRR(c, 660, 230, 250, 160, 22, COL.accent);
    fillRR(c, 660, open ? 196 : 230, 250, 64, 22, COL.primary);
    if (!open || s.budget > .5) for (let k = 0; k < 4; k++) circle(c, 720 + k * 42, open ? 200 - (k % 2) * 8 : 232, 18, COL.light);
    fillRR(c, 860, 290, 50, 40, 12, COL.p40); circle(c, 885, 310, 8, COL.accent);
    for (const k of s.coins) { circle(c, k.x, k.y, 16, COL.light); c.lineWidth = 4; c.strokeStyle = COL.accent; c.beginPath(); c.arc(k.x, k.y, 16, 0, 7); c.stroke(); }
    // food budget bar
    txt(c, 'FOOD BUDGET', 660, 438, `600 20px ${F.m}`, COL.g75);
    const money = (84.2 * (s.phase === 'caught' ? s.budget : 1)).toFixed(2);
    txt(c, '$' + money, 960, 438, `600 22px ${F.m}`, s.budget < .05 && open ? COL.primary : COL.ink, 'right');
    fillRR(c, 660, 452, 300, 22, 11, COL.g12);
    if (s.budget > 0 || !open) fillRR(c, 660, 452, Math.max(22, 300 * (open ? s.budget : 1)), 22, 11, COL.primary);
    caption(c, s.phase === 'caught' ? 'Line 3 is True, so line 4 raises an error. The else never runs.'
      : s.phase === 'friend' ? 'Line 3 is False, so it skips to else and runs line 6.' : 'Running…');
    if (s.flash > 0) { c.fillStyle = `rgba(30,85,255,${s.flash * .25})`; c.fillRect(0, 0, SW, SH); }
    done();
  },
};

/* ---------- 1 · procrastination.py · while loop ---------- */
CARDS[1] = {
  file: 'procrastination.py', concept: 'while loop',
  how: '<b>while True</b> never stops on its own. Tap Study, watch it loop, then fix it.',
  patchText: '        break  # put the phone down',
  init(api) { this.s = { phase: 'idle', checks: 0, t: 0, lift: 0, liftT: 0, err: 0, typed: 0, fixed: false, studyT: 0 }; },
  controls(api) {
    const study = document.createElement('button'); study.className = 'btn'; study.textContent = 'Study';
    const fix = document.createElement('button'); fix.className = 'btn ghost'; fix.textContent = 'Fix it: add break'; fix.hidden = true;
    study.onclick = () => this.start(api);
    fix.onclick = () => this.fix(api);
    this.ui = { study, fix }; this.syncUI();
    return [study, fix];
  },
  syncUI() {
    if (!this.ui) return; const { study, fix } = this.ui, s = this.s;
    study.disabled = s.phase === 'loop' || s.phase === 'fixing';
    study.textContent = s.phase === 'loop' ? 'Looping forever…' : s.phase === 'fixed' ? 'Run it again' : 'Study';
    study.style.opacity = study.disabled ? .55 : 1;
    fix.hidden = !(s.phase === 'loop' && s.checks >= 3 && !s.fixed);
    study.hidden = !fix.hidden;          // one button at a time
  },
  onFound(api) { if (this.s.phase === 'idle') { api.hl(3); api.out('Tap Study to run it.', 'sys'); } },
  iteration(api) {
    const s = this.s;
    return [
      { line: 4, wait: 300 },
      { line: 5, wait: 650, fn: () => { s.studyT = 1; } },
      { line: 6, wait: 520, chip: [5, 'Error'], fn: () => { s.err = 1; }, sfx: 'fal' },
      { line: 7, wait: 900, out: 'Phone check no. 47', fn: () => { s.checks++; s.lift = 1; s.liftT = 0; this.syncUI(); }, sfx: 'ping' },
      { line: 8, wait: 900, fn: () => {
          if (s.fixed) { api.runner.clear(); api.runner.push({ out: 'break', kind: 'sys', wait: 500, fn: () => { s.lift = 0; } },
            { line: null, wait: 10, fn: () => { s.phase = 'fixed'; s.t = 0; api.clearChips(); this.syncUI(); }, out: 'Loop ended. Back to studying.', sfx: 'win' }); return; }
          s.lift = 0; } },
      { line: 3, wait: 420, chip: [3, 'True'], fn: () => { api.chip(5, null); api.runner.push(...this.iteration(api)); } },
    ];
  },
  start(api) {
    const s = this.s; audioInit();
    if (s.phase === 'fixed') { s.fixed = false; s.typed = 0; api.patch(null); }
    s.phase = 'loop'; s.checks = 0; s.t = 0; api.clearChips(); this.syncUI();
    api.runner.run([{ line: 1, wait: 450 }, { line: 3, wait: 520, chip: [3, 'True'], sfx: 'tru' }, ...this.iteration(api)]);
  },
  fix(api) {
    const s = this.s; if (s.phase !== 'loop') return;
    s.phase = 'fixing'; s.typed = 0; this.syncUI(); api.out('Editing line 8…', 'sys');
  },
  update(api, dt) {
    const s = this.s; s.t += dt / 1000; s.err = Math.max(0, s.err - dt / 900); s.studyT = Math.max(0, s.studyT - dt / 700); s.liftT += dt / 1000;
    if (s.phase === 'fixing') {
      const before = Math.floor(s.typed); s.typed = Math.min(this.patchText.length, s.typed + dt / 28);
      if (Math.floor(s.typed) > before && this.patchText[Math.floor(s.typed) - 1] !== ' ') sfx.key();
      api.patch(this.patchText.slice(0, Math.floor(s.typed)), true);
      if (s.typed >= this.patchText.length) { s.fixed = true; s.phase = 'loop'; this.syncUI(); if (this.ui) this.ui.fix.hidden = true; }
    } else if (s.fixed) api.patch(this.patchText, false);
  },
  draw(c) {
    const s = this.s;
    const done = windowChrome(c, 'procrastination.py', s.phase === 'fixed' ? 'loop ended' : s.phase === 'idle' ? '' : 'while True');
    // window + desk
    fillRR(c, 60, 104, 240, 200, 12, COL.p16); c.fillStyle = COL.light; c.fillRect(176, 104, 8, 200); c.fillRect(60, 200, 240, 8);
    c.fillStyle = COL.furniture; fillRR(c, 90, 410, 840, 26, 8, COL.furniture); c.fillRect(130, 436, 22, 70); c.fillRect(870, 436, 22, 70);
    // student
    const look = s.lift > 0 ? 1 : 0, fixed = s.phase === 'fixed';
    fillRR(c, 430, 300, 150, 120, 40, COL.primary);
    head(c, 505 + look * 18, 256 + (fixed ? 14 : 0), 46, { sleep: false });
    // open book
    c.save(); c.translate(505, 398);
    const glow = s.studyT > 0 || fixed;
    for (const sx of [-1, 1]) {
      fillRR(c, sx < 0 ? -176 : 4, -34, 172, 44, 8, glow ? COL.p16 : COL.light);
      rr(c, sx < 0 ? -176 : 4, -34, 172, 44, 8); c.lineWidth = 3; c.strokeStyle = COL.ink; c.stroke();
      for (let k = 0; k < 3; k++) fillRR(c, (sx < 0 ? -160 : 20), -24 + k * 11, 120 - k * 20, 5, 2, glow ? COL.p60 : COL.g35);
    }
    c.restore();
    // phone
    let px = 760, py = 380, rot = 0;
    if (s.lift > 0) { const k = ease(Math.min(1, s.liftT / .35)); px = lerp(760, 610, k); py = lerp(380, 250, k); rot = lerp(0, -.25, k); }
    if (fixed) { const k = ease(Math.min(1, s.t / .6)); px = lerp(760, 1080, k); }
    const buzzing = s.phase === 'loop' && !s.lift && Math.sin(s.t * 40) > 0 && (s.t % 1.6) < .5;
    c.save(); c.translate(px + (buzzing ? 3 : 0), py); c.rotate(rot);
    fillRR(c, -26, -46, 52, 92, 10, COL.ink); fillRR(c, -20, -38, 40, 70, 4, s.lift ? COL.primary : COL.furniture);
    c.restore();
    if (buzzing) { c.strokeStyle = COL.primary; c.lineWidth = 4; for (const d of [-1, 1]) { c.beginPath(); c.arc(px, py, 64, d > 0 ? -.5 : Math.PI - .5, d > 0 ? .5 : Math.PI + .5); c.stroke(); } }
    // error tag
    if (s.err > 0) { c.globalAlpha = Math.min(1, s.err * 3); fillRR(c, 340, 128, 420, 52, 26, COL.ink); txt(c, 'MotivationNotFoundError', 550, 163, `600 24px ${F.m}`, COL.light, 'center'); c.globalAlpha = 1; }
    // counter
    txt(c, 'PHONE CHECKS', 960, 128, `600 20px ${F.m}`, COL.g75, 'right');
    txt(c, String(s.checks), 960, 232, `700 110px ${F.d}`, s.checks ? COL.primary : COL.g35, 'right');
    if (fixed) { fillRR(c, 700, 260, 260, 56, 28, COL.primary); txt(c, 'Loop ended ✓', 830, 297, `700 26px ${F.b}`, COL.light, 'center'); }
    caption(c, fixed ? 'break jumps out of the loop. Without it, while True runs forever.'
      : s.phase === 'idle' ? 'Tap Study.' : s.checks >= 3 ? 'It’s never going to stop on its own. Tap Fix it.' : 'study() fails, so except runs, then it loops back to line 3.');
    done();
  },
};

/* ---------- 2 · deadline.py · if / elif ---------- */
CARDS[2] = {
  file: 'deadline.py', concept: 'if / elif',
  how: 'Drag <b>days_left</b> down to 1. Watch which lines run on each day.',
  init(api) { this.s = { days: 7, phase: 'idle', say: '', t: 0, cans: [], shake: 0 }; },
  controls(api) {
    const w = document.createElement('div'); w.className = 'slider';
    w.innerHTML = `<div class="val">days_left = <b>${this.s.days}</b></div><input type="range" min="1" max="7" step="1" value="${this.s.days}" aria-label="days_left">`;
    const r = w.querySelector('input'), v = w.querySelector('b');
    r.oninput = () => { v.textContent = r.value; if (+r.value !== this.s.days) { this.s.days = +r.value; this.play(api); } };
    return [w];
  },
  onFound(api) { if (this.s.phase === 'idle') this.play(api); },
  play(api) {
    const s = this.s, d = s.days; api.clearChips(); api.dim(false); s.say = ''; s.t = 0;
    const steps = [{ line: 1, wait: 800, chip: [1, d === 7 ? 'True' : 'False'], sfx: d === 7 ? 'tru' : 'fal' }];
    if (d === 7) {
      s.phase = 'sofa';
      steps.push({ line: 2, wait: 900, out: 'Plenty of time.', fn: () => s.say = 'Plenty of time.' },
        { line: 3, wait: 1100, out: 'I\'ll start tomorrow.', fn: () => s.say = 'I’ll start tomorrow.' }, { line: null, wait: 10 });
    } else {
      steps.push({ line: 4, wait: 800, chip: [4, d === 1 ? 'True' : 'False'], sfx: d === 1 ? 'tru' : 'fal' });
      if (d === 1) {
        steps.push({ line: 5, wait: 550, fn: () => { s.phase = 'panic'; s.t = 0; } }, { line: 6, wait: 550, fn: () => s.shake = 1 },
          { line: 7, wait: 400, out: 'pull_all_nighter()', sfx: 'err' });
      } else {
        steps.push({ line: null, wait: 10, fn: () => { s.phase = 'nothing'; api.dim(true); }, out: `days_left is ${d}: nothing runs.`, kind: 'sys' });
      }
    }
    if (d !== 7) s.phase = 'sofa';      // panic / nothing get set when their line runs
    api.runner.run(steps);
  },
  update(api, dt) {
    const s = this.s; s.t += dt / 1000; s.shake = Math.max(0, s.shake - dt / 2500);
    if (s.phase === 'panic') {
      s.canT = (s.canT || 0) + dt / 1000;
      if (s.cans.length < 9 && s.canT > .45) s.canT = 0, s.cans.push({ x: 640 + Math.random() * 260, y: -40, vy: 0, land: 0 });
      for (const k of s.cans) {
        const floor = 410;
        if (!k.land) { k.vy += 1600 * dt / 1000; k.y += k.vy * dt / 1000; if (k.y >= floor) { k.y = floor; k.land = 1; blip(500, .05, 'square', .02); } }
      }
    } else s.cans = [];
  },
  draw(c) {
    const s = this.s, d = s.days, panic = s.phase === 'panic';
    c.save();
    if (s.shake > 0) c.translate((Math.random() - .5) * 14 * s.shake, (Math.random() - .5) * 10 * s.shake);
    const done = windowChrome(c, 'deadline.py', `days_left = ${d}`);
    // calendar
    fillRR(c, 48, 104, 250, 300, 18, COL.light); rr(c, 48, 104, 250, 300, 18); c.lineWidth = 4; c.strokeStyle = COL.ink; c.stroke();
    c.save(); rr(c, 48, 104, 250, 300, 18); c.clip(); c.fillStyle = d === 1 ? COL.primary : COL.ink; c.fillRect(48, 104, 250, 64); c.restore();
    txt(c, 'DAYS LEFT', 173, 148, `600 22px ${F.m}`, COL.light, 'center');
    txt(c, String(d), 173, 360, `700 190px ${F.d}`, d === 1 ? COL.primary : COL.ink, 'center');
    if (!panic) {
      // living room: sofa + lying student
      fillRR(c, 380, 320, 560, 100, 26, COL.edge); fillRR(c, 360, 380, 600, 70, 22, COL.furniture);
      fillRR(c, 350, 350, 60, 110, 20, COL.furniture); fillRR(c, 910, 350, 60, 110, 20, COL.furniture);
      fillRR(c, 500, 336, 250, 52, 24, COL.primary); fillRR(c, 740, 344, 140, 34, 17, COL.accent);
      const sleep = s.phase === 'nothing';
      head(c, 470, 350, 42, { sleep });
      if (!sleep) { c.save(); c.translate(540, 290); c.rotate(-.2); fillRR(c, -18, -30, 36, 60, 7, COL.ink); fillRR(c, -13, -24, 26, 46, 3, COL.p40); c.restore(); }
      if (sleep) { for (let k = 0; k < 3; k++) { const p = (s.t * .6 + k / 3) % 1; c.globalAlpha = 1 - p; txt(c, 'z', 520 + p * 80, 300 - p * 120, `700 ${30 + k * 10}px ${F.d}`, COL.g60); } c.globalAlpha = 1; }
      if (s.say) bubble(c, 420, 150, 520, s.say);
    } else {
      // all-nighter: sun/moon time-lapse, desk, laptop, energy cans
      const night = Math.floor(s.t * 2.5) % 2 === 1;
      fillRR(c, 360, 100, 230, 180, 12, night ? COL.ink : COL.p16);
      if (night) { circle(c, 475, 190, 40, COL.light); circle(c, 494, 178, 36, COL.ink); }
      else { circle(c, 475, 190, 38, COL.primary); }
      c.fillStyle = COL.light; c.fillRect(470, 100, 10, 180); c.fillRect(360, 186, 230, 8);
      fillRR(c, 360, 420, 600, 24, 8, COL.furniture); c.fillStyle = COL.furniture; c.fillRect(390, 444, 20, 60); c.fillRect(910, 444, 20, 60);
      fillRR(c, 560, 330, 190, 90, 18, COL.primary); head(c, 640, 290, 44, { wide: true });
      fillRR(c, 700, 330, 170, 104, 10, COL.ink); fillRR(c, 680, 418, 210, 12, 6, COL.edge);
      for (let k = 0; k < 4; k++) { const w = 40 + ((k * 37 + Math.floor(s.t * 8) * 13) % 90); fillRR(c, 716, 346 + k * 20, w, 8, 4, k % 2 ? COL.p60 : COL.code); }
      for (const k of s.cans) { fillRR(c, k.x - 14, k.y - 46, 28, 56, 6, COL.accent); c.fillStyle = COL.light; c.fillRect(k.x - 14, k.y - 24, 28, 8); bolt(c, k.x, k.y - 4, 1.2, COL.light); }
      txt(c, 'ALL-NIGHTER', 960, 128, `700 44px ${F.d}`, COL.primary, 'right');
    }
    caption(c, d === 7 ? 'days_left == 7 is True, so lines 2 and 3 run.'
      : d === 1 ? 'days_left == 1 is True, so the elif block runs. Panic.'
      : `days_left = ${d}: neither line matches, so nothing runs.`);
    done(); c.restore();
  },
};

/* ---------- 3 · lecture.py · try / except ---------- */
CARDS[3] = {
  file: 'lecture.py', concept: 'try / except',
  how: '<b>Hold</b> to pay attention. Let go, or zone out, and the <b>except</b> runs.',
  init(api) {
    let best = 0; try { best = +localStorage.getItem('l5ar-lecture-best') || 0; } catch (e) {}
    this.s = { phase: 'idle', att: 1, sec: 0, t: 0, phoneT: 0, best, nextPing: 2, ping: 0 };
  },
  controls(api) {
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Hold to listen';
    const sc = document.createElement('div'); sc.className = 'score'; sc.style.flexBasis = '100%';
    const down = e => { e.preventDefault(); audioInit(); b.dataset.on = '1'; this.listen(api); };
    const up = () => { if (b.dataset.on !== '1') return; b.dataset.on = '0'; if (this.s.phase === 'listen') this.zoneOut(api, 'let go'); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    b.addEventListener('contextmenu', e => e.preventDefault());
    this.ui = { b, sc }; this.syncUI();
    return [b, sc];
  },
  syncUI() { if (!this.ui) return; const s = this.s; this.ui.sc.innerHTML = s.best ? `Your best: <b>${fmt(s.best)}</b> of 5:00` : 'Nobody has made it to 5:00.'; },
  onFound(api) { if (this.s.phase === 'idle') api.runner.run([{ line: 1, wait: 600 }, { line: 3, wait: 600 }, { line: 4, wait: 10, out: 'Hold the button to listen.', kind: 'sys' }]); },
  listen(api) {
    const s = this.s; if (s.phase === 'listen') return;
    api.clearChips(); api.runner.clear(); api.hl(4); sfx.step();
    Object.assign(s, { phase: 'listen', att: 1, sec: 0, t: 0, nextPing: 1.2 + Math.random(), ping: 0 });
  },
  zoneOut(api, why) {
    const s = this.s; s.phase = 'except'; s.t = 0;
    const lasted = s.sec; if (lasted > s.best) { s.best = lasted; try { localStorage.setItem('l5ar-lecture-best', String(Math.round(lasted))); } catch (e) {} }
    api.runner.run([
      { chip: [4, 'Error'], out: 'AttentionSpanError', kind: 'err', wait: 650, sfx: 'err' },
      { line: 5, wait: 650 }, { line: 6, wait: 600, fn: () => { s.phoneT = 0; s.phase = 'phone'; } },
      { line: 7, wait: 900, out: 'phone.open("instagram", "tiktok")' },
      { line: null, wait: 10, out: `You lasted ${fmt(lasted)} of 5:00.`, kind: 'sys', fn: () => this.syncUI() },
    ]);
  },
  update(api, dt) {
    const s = this.s, k = dt / 1000; s.t += k; s.phoneT += k; s.ping = Math.max(0, s.ping - k * 1.5);
    if (s.phase === 'listen') {
      s.sec += k * 30;                                    // 1 real second = 30 lecture seconds
      s.att -= k * (0.10 + 0.045 * s.t);                  // gets harder the longer you go
      if (s.t > s.nextPing) { s.att -= 0.06 + Math.random() * 0.1; s.ping = 1; s.nextPing = s.t + 1 + Math.random() * 1.6; sfx.ping(); buzz(40); }
      if (s.sec >= 300) { s.sec = 300; s.phase = 'win'; api.out('You made it to 5:00. Respect.', 'sys'); sfx.win(); api.hl(null); }
      else if (s.att <= 0) { s.att = 0; this.zoneOut(api, 'zoned out'); }
    }
  },
  draw(c) {
    const s = this.s;
    const done = windowChrome(c, 'lecture.py', `${fmt(s.sec)} / 5:00`);
    // whiteboard + professor
    fillRR(c, 48, 100, 560, 320, 14, COL.furniture); fillRR(c, 62, 114, 532, 292, 8, COL.light);
    txt(c, 'Lecture 7: Cloud computing', 86, 162, `700 32px ${F.d}`, COL.ink);
    const prog = Math.min(1, s.sec / 300 * 3);
    for (let k = 0; k < 6; k++) { const w = [380, 300, 420, 260, 360, 320][k] * clamp(prog * 6 - k, 0, 1); if (w > 0) fillRR(c, 86, 196 + k * 34, w, 10, 5, k % 3 ? COL.g35 : COL.p40); }
    const wave = s.phase === 'listen' ? Math.sin(s.t * 5) * .3 : 0;
    fillRR(c, 650, 260, 110, 170, 30, COL.furniture); head(c, 705, 218, 40);
    c.lineWidth = 6; c.strokeStyle = COL.ink; c.beginPath(); c.arc(690, 222, 10, 0, 7); c.moveTo(700, 222); c.lineTo(710, 222); c.arc(720, 222, 10, Math.PI, Math.PI * 3); c.stroke();
    c.save(); c.translate(660, 300); c.rotate(-2.3 + wave); c.lineWidth = 14; c.lineCap = 'round'; c.strokeStyle = COL.furniture; c.beginPath(); c.moveTo(0, 0); c.lineTo(80, 0); c.stroke(); c.restore();
    // attention meter
    txt(c, 'ATTENTION', 800, 140, `600 20px ${F.m}`, COL.g75);
    fillRR(c, 800, 154, 170, 24, 12, COL.g12);
    if (s.att > 0) fillRR(c, 800, 154, Math.max(24, 170 * s.att), 24, 12, s.att < .3 ? COL.accent : COL.primary);
    if (s.ping > 0) { c.globalAlpha = s.ping; fillRR(c, 800, 204, 170, 62, 14, COL.ink); circle(c, 830, 235, 14, COL.primary); txt(c, 'new message', 852, 243, `400 20px ${F.b}`, COL.light); c.globalAlpha = 1; }
    // phone takes over
    if (s.phase === 'phone') {
      const k = ease(Math.min(1, s.phoneT / .5)); const y = lerp(640, 96, k);
      c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 30; fillRR(c, 380, y, 270, 400, 34, COL.ink); c.restore();
      fillRR(c, 396, y + 16, 238, 368, 22, COL.wall);
      const apps = [['instagram', COL.primary], ['tiktok', COL.accent]];
      apps.forEach(([n, col], i) => {
        const x = 420 + i * 112, yy = y + 46;
        fillRR(c, x, yy, 86, 86, 22, col);
        if (i === 0) { rr(c, x + 20, yy + 20, 46, 46, 14); c.strokeStyle = COL.light; c.lineWidth = 6; c.stroke(); c.beginPath(); c.arc(x + 43, yy + 43, 11, 0, 7); c.stroke(); circle(c, x + 58, yy + 28, 4, COL.light); }
        else { c.fillStyle = COL.light; c.fillRect(x + 46, yy + 20, 8, 38); circle(c, x + 40, yy + 60, 12, COL.light); c.fillRect(x + 46, yy + 20, 18, 8); }
        txt(c, n, x + 43, yy + 116, `400 18px ${F.b}`, COL.soft, 'center');
      });
      txt(c, 'You lasted', 515, y + 236, `400 24px ${F.b}`, COL.soft, 'center');
      txt(c, fmt(s.sec), 515, y + 310, `700 76px ${F.d}`, COL.light, 'center');
      txt(c, 'of 5:00', 515, y + 346, `400 22px ${F.m}`, COL.g60, 'center');
    }
    caption(c, s.phase === 'listen' ? 'try: line 4 runs as long as you keep holding.'
      : s.phase === 'phone' || s.phase === 'except' ? 'Line 4 hit an error, so Python jumps to except.'
      : s.phase === 'win' ? 'No error, so the except never runs.' : 'Hold the button to start listening.');
    done();
  },
};
function fmt(sec) { sec = Math.round(sec); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

/* =====================================================================
   AR COMPONENT: one per card target
   ===================================================================== */
const state = { active: null, lostTimer: null, started: false };
const TIMESCALE = +new URLSearchParams(location.search).get('timescale') || 1;   // tests only

AFRAME.registerComponent('code-card', {
  schema: { index: { type: 'int' } },
  init() {
    const i = this.data.index, card = this.card = Object.create(CARDS[i]);
    this.visible = false;
    const root = this.root = new THREE.Group(); this.el.setObject3D('l5', root);
    // debugger bar: translucent blue band + solid edge, slides between lines
    const bar = this.bar = new THREE.Group();
    const band = colorPlane(1, U(36), COL.primary, .32), edgeP = colorPlane(U(7), U(36), COL.primary, 1);
    band.position.z = .002; edgeP.position.set(-.5 + U(3.5), 0, .003); bar.add(band, edgeP);
    bar.visible = false; root.add(bar); this.barY = LINE_Y(1); this.barTarget = null; this.barA = 0;
    // dimmer over the code area (used when nothing runs)
    const dim = this.dimP = colorPlane(1, U(318), COL.ink, 0); dim.position.set(0, PX(0, 54 + 159)[1], .004); root.add(dim); this.dimA = 0; this.dimT = 0;
    // chips (True / False / Error) to the right of a line
    this.chips = {};
    // live line patch (procrastination: types `break` over line 8)
    this.patchP = null;
    // the program window above the card
    const win = this.win = canvasPlane(1, 1 * SH / SW, SW, SH);
    win.mesh.position.set(0, U(CH / 2) + .03 + (SH / SW) / 2, .06); root.add(win.mesh); this.winK = 0;
    // api for the card logic
    const self = this;
    this.api = {
      runner: null,
      hl(n) { self.barTarget = n; if (n) self.barY = self.bar.visible ? self.barY : LINE_Y(n); },
      chip(n, label) { self.setChip(n, label); },
      clearChips() { for (const n in self.chips) self.setChip(+n, null); },
      dim(on) { self.dimT = on ? .62 : 0; },
      out(s, kind) { if (state.active === self) logLine(s, kind); else self.pending.push([s, kind]); },
      patch(text, cursor) { self.setPatch(text, cursor); },
    };
    this.pending = [];
    this.api.runner = Runner(this.api);
    card.init(this.api);
    this.el.addEventListener('targetFound', () => onFound(this));
    this.el.addEventListener('targetLost', () => onLost(this));
  },
  setChip(n, label) {
    let ch = this.chips[n];
    if (!label) { if (ch) ch.p.mesh.visible = false; return; }
    const kind = label === 'Error' ? 'err' : 'bool';
    if (ch && ch.kind !== kind) { this.root.remove(ch.p.mesh); ch = null; }
    if (!ch) {
      const p = kind === 'err' ? canvasPlane(U(28), U(28), 80, 80) : canvasPlane(U(86), U(26), 240, 72);
      p.mesh.position.set(PX(kind === 'err' ? 640 - 6 - 14 : 640 - 8 - 43, 0)[0], PX(0, LINE_Y(n))[1], .008);
      this.root.add(p.mesh); ch = this.chips[n] = { p, t: 0, kind };
    }
    const c = ch.p.ctx; c.clearRect(0, 0, ch.p.w, ch.p.h);
    if (kind === 'err') { circle(c, 40, 40, 37, COL.light); circle(c, 40, 40, 30, COL.primary); txt(c, '!', 40, 55, `700 44px ${F.d}`, COL.light, 'center'); }
    else { fillRR(c, 2, 2, 236, 68, 34, label === 'True' ? COL.primary : COL.furniture); txt(c, label, 120, 48, `600 36px ${F.m}`, COL.light, 'center'); }
    ch.p.dirty(); ch.p.mesh.visible = true; ch.t = 0; ch.p.mesh.scale.setScalar(.6);
  },
  setPatch(text, cursor) {
    if (text == null) { if (this.patchP) this.patchP.mesh.visible = false; return; }
    if (!this.patchP) {
      const w = 640 - 44, p = this.patchP = canvasPlane(U(w), U(36), 1192, 72);
      p.mesh.position.set(PX(44 + w / 2, 0)[0], PX(0, LINE_Y(8))[1], .007); this.root.add(p.mesh);
    }
    const p = this.patchP, c = p.ctx, s = 2;            // 2 canvas px per card px
    c.fillStyle = COL.hl; c.fillRect(0, 0, p.w, p.h);
    c.fillStyle = COL.primary; c.fillRect(0, 0, 4, p.h);
    c.font = `400 ${20 * s}px ${F.m}`; let x = (58 - 44) * s; const y = 47;
    // simple syntax colours: keyword, comment, rest
    const m = text.match(/^(\s*)(\w*)(\s*)(#.*)?/) || [];
    const parts = [[m[1] || '', COL.code], [m[2] || '', COL.p60], [m[3] || '', COL.code], [m[4] || '', COL.g60]];
    for (const [t, col] of parts) { if (!t) continue; c.fillStyle = col; c.fillText(t, x, y); x += c.measureText(t).width; }
    if (cursor && Math.floor(performance.now() / 300) % 2 === 0) { c.fillStyle = COL.code; c.fillRect(x + 2, 14, 4, 44); }
    p.dirty(); p.mesh.visible = true;
  },
  tick(t, dtRaw) {
    if (!this.visible) return;
    const dt = Math.min(dtRaw || 16, 100) * TIMESCALE;
    this.api.runner.update(dt);
    this.card.update(this.api, dt);
    // bar
    if (this.barTarget) { this.bar.visible = true; this.barA = Math.min(1, this.barA + dt / 150); this.barY = lerp(this.barY, LINE_Y(this.barTarget), Math.min(1, dt / 70)); }
    else { this.barA = Math.max(0, this.barA - dt / 250); if (this.barA === 0) this.bar.visible = false; }
    this.bar.position.y = PX(0, this.barY)[1];
    this.bar.children[0].material.opacity = .32 * this.barA * (0.85 + .15 * Math.sin(t / 180));
    this.bar.children[1].material.opacity = this.barA;
    // dimmer
    this.dimA = lerp(this.dimA, this.dimT, Math.min(1, dt / 160)); this.dimP.material.opacity = this.dimA;
    // chips pop
    for (const n in this.chips) { const ch = this.chips[n]; if (!ch.p.mesh.visible) continue; ch.t += dt; const k = Math.min(1, ch.t / 180); ch.p.mesh.scale.setScalar(.6 + .4 * ease(k) + .08 * Math.sin(k * Math.PI)); }
    // window pops up out of the card
    this.winK = Math.min(1, this.winK + dt / 380); const k = ease(this.winK);
    this.win.mesh.scale.set(lerp(.85, 1, k), Math.max(.001, k), 1);
    this.win.mesh.position.y = U(CH / 2) + .03 + (SH / SW) / 2 * k;
    this.win.mat.opacity = k;
    this.card.draw(this.win.ctx); this.win.dirty();
  },
});

/* ---------- found / lost + sheet UI ---------- */
function onFound(comp) {
  clearTimeout(state.lostTimer);
  if (state.active && state.active !== comp) state.active.visible = false;
  const fresh = state.active !== comp;
  state.active = comp; comp.visible = true;
  if (fresh) { comp.winK = 0; buildSheet(comp); }
  $('scan').hidden = true; $('topState').textContent = comp.card.file; $('sheet').classList.add('on');
  comp.card.onFound && comp.card.onFound(comp.api);
  blip(660, .05, 'sine', .04);
}
function onLost(comp) {
  if (state.active !== comp) return;
  comp.visible = false;                          // pause the program while you can't see it
  clearTimeout(state.lostTimer);
  state.lostTimer = setTimeout(() => { $('sheet').classList.remove('on'); $('scan').hidden = false; $('topState').textContent = 'Scanning'; $('scanText').textContent = 'Point at a code card'; }, 1600);
  $('scanText').textContent = 'Lost it. Hold steady on the card';
}
function buildSheet(comp) {
  const card = comp.card;
  $('shFile').textContent = card.file; $('shConcept').textContent = card.concept; $('shHow').innerHTML = card.how;
  const ctl = $('shCtl'); ctl.innerHTML = ''; card.controls(comp.api).forEach(n => ctl.appendChild(n));
  $('shConsole').innerHTML = '';
  for (const [s, k] of comp.pending.splice(0)) logLine(s, k);
}
function logLine(s, kind) {
  const box = $('shConsole'), d = document.createElement('div'); d.className = 'ln' + (kind ? ' ' + kind : ''); d.textContent = s; box.appendChild(d);
  while (box.children.length > 2) box.firstChild.remove();
}

/* ---------- build the scene + start ---------- */
function buildScene() {
  const sc = document.createElement('a-scene');
  sc.setAttribute('mindar-image', 'imageTargetSrc: targets/targets.mind; maxTrack: 1; autoStart: false; uiLoading: no; uiScanning: no; uiError: yes; filterMinCF: 0.0001; filterBeta: 0.001; missTolerance: 8; warmupTolerance: 3');
  sc.setAttribute('color-space', 'sRGB');
  sc.setAttribute('renderer', 'colorManagement: true; antialias: true; alpha: true');
  sc.setAttribute('vr-mode-ui', 'enabled: false');
  sc.setAttribute('device-orientation-permission-ui', 'enabled: false');
  sc.setAttribute('loading-screen', 'enabled: false');
  sc.innerHTML = '<a-camera position="0 0 0" look-controls="enabled: false"></a-camera>' +
    [0, 1, 2, 3].map(i => `<a-entity mindar-image-target="targetIndex: ${i}" code-card="index: ${i}"></a-entity>`).join('');
  $('scene').appendChild(sc);
  return sc;
}
async function start() {
  if (state.started) return; state.started = true; audioInit();
  $('goBtn').textContent = 'Starting camera…';
  await document.fonts.load(`700 30px ${F.d}`).catch(() => {}); await document.fonts.load(`400 20px ${F.m}`).catch(() => {}); await document.fonts.load(`700 20px ${F.b}`).catch(() => {});
  const sc = buildScene();
  const go = () => {
    const ar = sc.systems['mindar-image-system'];
    sc.addEventListener('arReady', () => { $('start').hidden = true; $('top').hidden = false; $('scan').hidden = false; });
    sc.addEventListener('arError', () => { $('goBtn').textContent = 'Camera blocked. Allow it and reload.'; });
    ar.start();
  };
  if (sc.hasLoaded) go(); else sc.addEventListener('loaded', go);
}
$('goBtn').addEventListener('click', start);
if (new URLSearchParams(location.search).has('autostart')) start();   // used by the automated tests
window.L5AR = { state, CARDS };
