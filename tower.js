// noprotect
// ============================================================
// 청감 타워 — 네온 버전 (p5.js 1.x / 2.x 공용)
//
// 검은 배경 위에 네온 기둥과 잎사귀 둘레길. 아래가 20Hz(낮은 소리), 위가 20kHz(높은 소리).
// 달팽이는 자기 주파수 높이에 열리는 포탈로 "접속"해서 들어온 뒤 잎사귀 길을 기어다닌다.
//
// 그리기는 전부 캔버스 2D(drawingContext)로 하고 3D 는 직접 투영한다.
// → p5 버전에 상관없이 같은 화면이 나온다.
//
// 원본: ref/sketch (14).js (11/12 실제 비주얼). 이 파일은 그 포트이고, 달팽이는 app.js가 피드에서 받아
//       snail-sticker.js로 그린 그림을 addSnail로 넘긴다. 바꾼 곳은 '포트:' 주석.
// 조작: 드래그 = 타워 돌리기   B 인식 박스 켜기/끄기   O 자동 회전 켜기/끄기   P 다변기 부품 떨어뜨리기
//       D 디버그 창 (app.js). ?demo=1 이면 클릭/스페이스 = 임시 달팽이 접속
// ============================================================

/* ───────────── 조절값 ───────────── */
const CFG = {
  SERVER_URL: '',            // 예: 'wss://내서버/snails' — 비워두면 데모 모드
  DEMO: location.search.includes('demo=1'), // 포트: ?demo=1 일 때만 임시 달팽이를 자동으로 접속시킴
  DEMO_INTERVAL: 6,          // 초
  DEMO_MAX: 10,              // 자동으로 접속시키는 마릿수

  // 주파수(Hz) → 둘레길 높이(0 = 바닥·저음, 1 = 꼭대기·고음). 12000–19000Hz 구간을 크게 벌린다.
  FREQ_MAP: [[20, 0.00], [12000, 0.30], [19000, 0.92], [20000, 1.00]],

  // 북서울미술관 팔레트 (낮은 소리 → 높은 소리). NEON 값만큼 채도·밝기를 끌어올려 쓴다.
  PALETTE: ['#B19E6B', '#808E30', '#5C6A36', '#8C7256', '#A8765C',
            '#978A87', '#C4B8B0', '#A8B0C1', '#7CA0BA', '#6C9AD1'],
  NEON: 0.85,                // 0 = 원래 팔레트 색, 1 = 완전한 네온

  VIEW_SIZE: 840,            // 타워 투영 기준 크기
  DEFAULT_CONTROLS: true,    // 관객용은 터치 제스처를 별도로 연결
  SNAIL_SIZE: 84,            // 달팽이 가로 크기 (타워 높이 600 기준)
  SNAIL_FACES_RIGHT: true,   // 넘어오는 달팽이 그림이 오른쪽을 보고 있으면 true
  ARRIVAL_SPREAD: 0.12,      // 도착 위치가 고역 한계 기준점에서 벗어날 수 있는 최대 거리 (둘레길 전체 = 1)
  WANDER: 0.07,              // 달팽이가 제자리에서 벗어나 돌아다니는 범위 (둘레길 전체 = 1)
  MAX_SNAILS: 40,
  PORTAL_SEC: 3.6,           // 포탈이 열렸다 닫히는 시간
  ORBIT: 0.05,               // 자동 회전 속도 (rad/s), 0 이면 정지
  // 이스터에그: 아날로그 다변기 부품이 바닥에 쓰레기처럼 떨어져 쌓인다
  PARTS_START: 5,            // 처음부터 바닥에 놓여 있는 개수
  PART_INTERVAL: 16,         // 몇 초마다 하나씩 떨어지는지 (0 이면 자동으로 떨어지지 않음)
  MAX_PARTS: 18,
  PART_SIZE: 50,             // 부품 길이 (타워 높이 600 기준)
  PART_COLOR: [206, 214, 226], // 부품 색 (실버)
  BOXES: true,               // 달팽이 인식 박스와 청감 코드 이름표
  DEMO_CODES: true,          // 테스트 달팽이에 가짜 청감 코드를 붙여 미리 본다
  LABEL_COLOR: [240, 92, 62], // 청감 코드 글자색
  LABELS: true,              // "20 Hz · 낮은 소리" 글자
};

/* ───────────── 타워 치수 ───────────── */
const TW = { H: 600, RT: 30, RB: 150, TURNS: 3.3, TH0: 0.6 };
const CAM = { D: 1500, EL: 0.3, CY: 270 };

/* ───────────── 상태 ───────────── */
let ctx;
let neonStops = [];
let leaves = [];
let dots = [];
let snails = [];
let sparks = [];
let parts = [];
let lastPart = 0;
let placeholders = [];
let camA = 0.5;
let orbitOn = true;
let view = {};
let lastDemo = -4;
let demoSent = 0;
let snailSeq = 0;
let pressOnCanvas = false;
let dragMoved = 0;
let ws = null;

const clampN = (x, a, b) => Math.min(b, Math.max(a, x));
const mixN = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clampN((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + clampN(a, 0, 1).toFixed(3) + ')';
const mul = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];

/* ============================================================
   색 — 북서울 팔레트를 네온으로
   ============================================================ */
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(c) {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) { h = (g - b) / d + (g < b ? 6 : 0); }
    else if (mx === g) { h = (b - r) / d + 2; }
    else { h = (r - g) / d + 4; }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  const f = (p, q, t) => {
    if (t < 0) { t += 1; }
    if (t > 1) { t -= 1; }
    if (t < 1 / 6) { return p + (q - p) * 6 * t; }
    if (t < 1 / 2) { return q; }
    if (t < 2 / 3) { return p + (q - p) * (2 / 3 - t) * 6; }
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}

function neonify(hex) {
  const hsl = rgbToHsl(hexToRgb(hex));
  return hslToRgb(hsl[0], mixN(hsl[1], 1, CFG.NEON), mixN(hsl[2], 0.57, CFG.NEON * 0.75));
}

// s 는 둘레길 좌표: 0 = 꼭대기(고음) … 1 = 바닥(저음). 팔레트는 저음→고음 순서라 뒤집어 읽는다.
function colorAt(s) {
  const n = neonStops.length - 1;
  const x = clampN(1 - s, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const t = x - i;
  const a = neonStops[i], b = neonStops[i + 1];
  return [mixN(a[0], b[0], t), mixN(a[1], b[1], t), mixN(a[2], b[2], t)];
}

// 기둥의 열화상 느낌: 차가움(하늘) → 뜨거움(붉은 흙)
function heatColor(h) {
  const ramp = [neonStops[9], neonStops[8], neonStops[1], neonStops[0], neonStops[4]];
  const x = clampN(h, 0, 1) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(x));
  const t = x - i;
  return [mixN(ramp[i][0], ramp[i + 1][0], t), mixN(ramp[i][1], ramp[i + 1][1], t), mixN(ramp[i][2], ramp[i + 1][2], t)];
}

/* ============================================================
   형태와 투영
   ============================================================ */
function pillarR(y) { return mixN(TW.RB, TW.RT, clampN(y / TW.H, 0, 1)); }

// 둘레길 위의 점. s: 0 = 꼭대기 … 1 = 바닥
function helix(s) {
  const y = TW.H * (1 - s) * 0.93 + 16;
  const th = TW.TH0 + Math.PI * 2 * TW.TURNS * Math.pow(s, 0.82);
  const r = pillarR(y) + 14 + 150 * Math.pow(s, 1.7);
  return [r * Math.cos(th), y, r * Math.sin(th), th, r];
}

function updateView() {
  view.cosA = Math.cos(camA); view.sinA = Math.sin(camA);
  view.cosE = Math.cos(CAM.EL); view.sinE = Math.sin(CAM.EL);
  view.F = CAM.D * Math.min(width, height) / CFG.VIEW_SIZE;
  view.cx = width * 0.5;
  view.cy = height * 0.5;
}

// 3D 점 → [화면 x, 화면 y, 카메라까지 거리, 확대율]
function project(p) {
  const y = p[1] - CAM.CY;
  const x1 = p[0] * view.cosA - p[2] * view.sinA;
  const z1 = p[0] * view.sinA + p[2] * view.cosA;
  const y2 = y * view.cosE - z1 * view.sinE;
  const z2 = y * view.sinE + z1 * view.cosE;
  const zc = CAM.D - z2;
  const k = view.F / zc;
  return [view.cx + x1 * k, view.cy - y2 * k, zc, k];
}

function axisDepth(y) { return CAM.D - (y - CAM.CY) * view.sinE; }

function buildLeaves() {
  leaves = [];
  let s = 0.012;
  let i = 0;
  while (s < 1) {
    const len = 34 + 104 * s;
    const a = helix(s), b = helix(Math.min(1, s + 0.002));
    const rate = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.002;
    leaves.push({
      s, len, wid: len * random(0.54, 0.64),
      roll: random(-0.22, 0.3), yaw: random(-0.16, 0.16), ph: random(Math.PI * 2),
      bend: random(-0.08, 0.08), i: i++,
    });
    s += (len * random(0.4, 0.5)) / rate;
  }
}

function buildDots() {
  dots = [];
  for (let i = 0; i < 2400; i++) {
    dots.push({ a: random(Math.PI * 2), v: random(), r: random(0.7, 1.5), n: random() });
  }
}

/* ============================================================
   그리기 도우미
   ============================================================ */
function glowLine(pts, col, w, alpha, closed) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { ctx.lineTo(pts[i][0], pts[i][1]); }
  if (closed) { ctx.closePath(); }
  ctx.strokeStyle = rgba(col, alpha * 0.13);
  ctx.lineWidth = w * 5;
  ctx.stroke();
  ctx.strokeStyle = rgba(col, alpha * 0.3);
  ctx.lineWidth = w * 2.2;
  ctx.stroke();
  ctx.strokeStyle = rgba(mul(col, 1.25), alpha);
  ctx.lineWidth = w;
  ctx.stroke();
}

function fillPoly(pts, style) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { ctx.lineTo(pts[i][0], pts[i][1]); }
  ctx.closePath();
  ctx.fillStyle = style;
  ctx.fill();
}

/* ───────────── 잎사귀 ───────────── */
function leafLit(s) {
  let lit = 0;
  for (const sn of snails) {
    const d = (sn.s - s) / 0.028;
    const v = Math.exp(-d * d) * (sn.state === 'live' ? 1 : sn.reveal);
    if (v > lit) { lit = v; }
  }
  return lit;
}

function drawLeaf(L, now, back) {
  const h = helix(L.s);
  const h2 = helix(Math.min(1, L.s + 0.003));
  // 길 방향(T), 바깥 방향(Rd)
  let tx = h2[0] - h[0], ty = h2[1] - h[1], tz = h2[2] - h[2];
  const tl = Math.hypot(tx, ty, tz) || 1;
  tx /= tl; ty /= tl; tz /= tl;
  const rx = Math.cos(h[3]), rz = Math.sin(h[3]);
  // 잎의 긴 축: 길 방향과 바깥 방향 사이
  const ya = 0.62 + L.yaw;
  let ax = tx * Math.cos(ya) + rx * Math.sin(ya);
  let ay = ty * Math.cos(ya) - 0.1;
  let az = tz * Math.cos(ya) + rz * Math.sin(ya);
  const al = Math.hypot(ax, ay, az);
  ax /= al; ay /= al; az /= al;
  // 잎의 폭 축: 수평에서 살짝 기울고 흔들린다
  let bx = -az, bz = ax;
  const bl = Math.hypot(bx, bz) || 1;
  bx /= bl; bz /= bl;
  const roll = L.roll + 0.07 * Math.sin(now * 0.9 + L.ph);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const B = [bx * cr, sr, bz * cr];
  const base = [h[0] - ax * L.len * 0.3, h[1] - ay * L.len * 0.3, h[2] - az * L.len * 0.3];

  const N = 9;
  const up = [], lo = [], mid = [];
  for (let j = 0; j <= N; j++) {
    const t = j / N;
    const w = L.wid * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.7);
    const sag = -L.len * 0.1 * t * t + L.len * L.bend * Math.sin(Math.PI * t);
    const c = [base[0] + ax * L.len * t, base[1] + ay * L.len * t + sag, base[2] + az * L.len * t];
    mid.push(project(c));
    up.push(project([c[0] + B[0] * w, c[1] + B[1] * w + w * 0.18, c[2] + B[2] * w]));
    lo.push(project([c[0] - B[0] * w, c[1] - B[1] * w + w * 0.18, c[2] - B[2] * w]));
  }
  const zc = mid[N >> 1][2];
  const fade = mixN(1, 0.34, sstep(CAM.D - 260, CAM.D + 330, zc)) * (back ? 0.72 : 1);
  const lit = leafLit(L.s);
  const flick = 0.92 + 0.08 * Math.sin(now * 2.3 + L.ph * 3);
  const col = colorAt(L.s);
  const bright = fade * flick * (1 + lit * 0.9);

  // 어두운 면 두 장 (종이접기처럼 반으로 접힌 잎)
  ctx.globalCompositeOperation = 'source-over';
  const half1 = up.concat(mid.slice().reverse());
  const half2 = lo.concat(mid.slice().reverse());
  fillPoly(half1, rgba(mul(col, 0.27 * bright + lit * 0.2), 0.93));
  fillPoly(half2, rgba(mul(col, 0.13 * bright + lit * 0.12), 0.93));

  // 네온 윤곽과 잎맥
  ctx.globalCompositeOperation = 'lighter';
  const outline = up.concat(lo.slice(0, N).reverse());
  const lw = clampN(mid[0][3] * 1.5, 0.7, 2.2);
  glowLine(outline, col, lw, 0.85 * bright, true);
  glowLine(mid, col, lw * 0.8, 0.55 * bright, false);
  if (L.len * mid[0][3] > 46) {
    ctx.strokeStyle = rgba(col, 0.2 * bright);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let j = 2; j < N - 1; j += 2) {
      ctx.moveTo(mid[j][0], mid[j][1]); ctx.lineTo(up[j + 1][0], up[j + 1][1]);
      ctx.moveTo(mid[j][0], mid[j][1]); ctx.lineTo(lo[j + 1][0], lo[j + 1][1]);
    }
    ctx.stroke();
  }
}

/* ───────────── 기둥 ───────────── */
function drawPillar(now) {
  const M = 48;
  const yT = TW.H, yB = 0;
  const top = [], bot = [], facing = [];
  for (let i = 0; i <= M; i++) {
    const a = (i / M) * Math.PI * 2;
    top.push(project([TW.RT * Math.cos(a), yT, TW.RT * Math.sin(a)]));
    bot.push(project([TW.RB * Math.cos(a), yB, TW.RB * Math.sin(a)]));
    const am = ((i + 0.5) / M) * Math.PI * 2;
    facing.push(Math.cos(am) * view.sinA + Math.sin(am) * view.cosA);
  }

  // 검은 몸통 — 뒤쪽 잎을 가린다
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < M; i++) {
    if (facing[i] <= -0.02) { continue; }
    const g = 4 + 9 * facing[i];
    fillPoly([top[i], top[i + 1], bot[i + 1], bot[i]], 'rgb(' + (g * 0.5 | 0) + ',' + (g * 0.8 | 0) + ',' + (g | 0) + ')');
  }
  fillPoly(top.slice(0, M), 'rgb(3,5,7)');

  ctx.globalCompositeOperation = 'lighter';

  // 열화상 점묘 — 스캔 띠가 위아래로 지나간다
  const scan = (now * 0.11) % 1.3 - 0.15;
  for (const d of dots) {
    const f = Math.cos(d.a) * view.sinA + Math.sin(d.a) * view.cosA;
    if (f < 0.03) { continue; }
    const band = Math.exp(-Math.pow((d.v - scan) / 0.045, 2));
    const heat = noise(Math.cos(d.a) * 1.4 + 5, Math.sin(d.a) * 1.4 + 5, d.v * 4.5 - now * 0.12) * 1.25 - 0.18 + band * 0.55;
    if (heat < 0.33 + d.n * 0.16) { continue; }
    const y = d.v * TW.H;
    const r = pillarR(y) + 0.5;
    const p = project([r * Math.cos(d.a), y, r * Math.sin(d.a)]);
    const sz = Math.max(1, p[3] * 2.1 * d.r);
    ctx.fillStyle = rgba(heatColor(heat), (0.25 + 0.75 * sstep(0.38, 0.8, heat)) * (0.35 + 0.65 * f));
    ctx.fillRect(p[0] - sz * 0.5, p[1] - sz * 0.5, sz, sz);
  }

  // 세로줄
  for (let i = 0; i < M; i += 4) {
    const f = Math.cos((i / M) * Math.PI * 2) * view.sinA + Math.sin((i / M) * Math.PI * 2) * view.cosA;
    if (f < 0.02) { continue; }
    const grad = ctx.createLinearGradient(top[i][0], top[i][1], bot[i][0], bot[i][1]);
    grad.addColorStop(0, rgba(colorAt(0.05), 0.5 * f));
    grad.addColorStop(0.5, rgba(colorAt(0.5), 0.34 * f));
    grad.addColorStop(1, rgba(colorAt(0.95), 0.5 * f));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(top[i][0], top[i][1]);
    ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.stroke();
  }

  // 가로 링 (앞쪽 반만)
  const RINGS = 13;
  for (let j = 0; j <= RINGS; j++) {
    const v = j / RINGS;
    const y = v * TW.H;
    const r = pillarR(y);
    const col = colorAt(1 - v);
    const near = Math.exp(-Math.pow((v - scan) / 0.06, 2));
    ctx.strokeStyle = rgba(col, 0.2 + 0.6 * near + (j === 0 || j === RINGS ? 0.4 : 0));
    ctx.lineWidth = 1 + near;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= M; i++) {
      const a = (i / M) * Math.PI * 2;
      const f = Math.cos(a) * view.sinA + Math.sin(a) * view.cosA;
      if (f < -0.02 && j !== RINGS) { started = false; continue; }
      const p = project([r * Math.cos(a), y, r * Math.sin(a)]);
      if (started) { ctx.lineTo(p[0], p[1]); } else { ctx.moveTo(p[0], p[1]); started = true; }
    }
    ctx.stroke();
  }

  // 스캔 띠
  if (scan > 0 && scan < 1) {
    const y = scan * TW.H;
    const r = pillarR(y) + 2;
    const ring = [];
    for (let i = 0; i <= M; i++) {
      const a = (i / M) * Math.PI * 2;
      if (Math.cos(a) * view.sinA + Math.sin(a) * view.cosA < 0) { continue; }
      ring.push(project([r * Math.cos(a), y, r * Math.sin(a)]));
    }
    ring.sort((p, q) => p[0] - q[0]);
    if (ring.length > 2) { glowLine(ring, colorAt(1 - scan), 1.4, 0.9, false); }
  }
}

/* ============================================================
   달팽이 — 넘어온 그림은 그대로 쓴다 (검은 배경은 빛으로 합성되어 사라진다)
   ============================================================ */
function braidPath(c, pts, col) {
  const A = [], B = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
    let tx = q[0] - o[0], ty = q[1] - o[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    if (i > 0) { acc += Math.hypot(p[0] - o[0], p[1] - o[1]); }
    const off = Math.sin(acc * 0.5) * 2.6;
    A.push([p[0] - ty * off, p[1] + tx * off]);
    B.push([p[0] + ty * off, p[1] - tx * off]);
  }
  for (const pass of [[7, 0.1], [3.4, 0.22], [1.5, 0.95]]) {
    c.strokeStyle = rgba(col, pass[1]);
    c.lineWidth = pass[0];
    for (const S of [A, B]) {
      c.beginPath();
      c.moveTo(S[0][0], S[0][1]);
      for (let i = 1; i < S.length; i++) { c.lineTo(S[i][0], S[i][1]); }
      c.stroke();
    }
  }
}

function smoothPath(pts, iters, closed) {
  let P = pts;
  for (let it = 0; it < iters; it++) {
    const Q = [];
    const n = P.length;
    const last = closed ? n : n - 1;
    if (!closed) { Q.push(P[0]); }
    for (let i = 0; i < last; i++) {
      const a = P[i], b = P[(i + 1) % n];
      Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      Q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) { Q.push(P[n - 1]); }
    P = Q;
  }
  if (closed) { P = P.concat([P[0]]); }
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
    for (let j = 0; j < n; j++) { out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
  }
  out.push(P[P.length - 1]);
  return out;
}

// 데모용 임시 달팽이 (실제로는 서버에서 온 그림으로 대체)
function makePlaceholder(variant) {
  const cv = document.createElement('canvas');
  cv.width = 300; cv.height = 200;
  const c = cv.getContext('2d');
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.globalCompositeOperation = 'lighter';
  const col = [[236, 222, 160], [246, 232, 176], [226, 216, 180]][variant % 3];
  braidPath(c, smoothPath([[38, 172], [120, 175], [214, 172], [236, 140], [244, 110], [226, 99], [196, 104],
    [160, 100], [118, 98], [86, 112], [66, 138], [50, 160]], 2, true), col);
  const sp = [];
  const turns = 3.25 + (variant % 2) * 0.5;
  for (let a = 0; a <= turns * Math.PI * 2; a += 0.12) {
    const r = 37 * a / (turns * Math.PI * 2);
    const ang = a + Math.PI / 2 - turns * Math.PI * 2;
    sp.push([150 + r * Math.cos(ang), 62 + r * Math.sin(ang)]);
  }
  braidPath(c, smoothPath(sp, 0, false), col);
  braidPath(c, smoothPath([[236, 104], [250, 90], [260, 78]], 1, false), col);
  braidPath(c, smoothPath([[242, 110], [264, 100], [282, 92]], 1, false), col);
  c.globalCompositeOperation = 'source-over';
  for (const e of [[260, 76], [283, 91]]) {
    c.strokeStyle = rgba(col, 0.9); c.lineWidth = 1.3;
    c.beginPath(); c.arc(e[0], e[1], 6.5, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgb(255,70,44)';
    c.beginPath(); c.arc(e[0], e[1], 3.3, 0, Math.PI * 2); c.fill();
  }
  return cv;
}

/* ───────────── 주파수 → 둘레길 위치 ───────────── */
function hzToUnit(hz) {
  const M = CFG.FREQ_MAP;
  hz = clampN(hz, M[0][0], M[M.length - 1][0]);
  for (let i = 1; i < M.length; i++) {
    if (hz <= M[i][0]) {
      const a = M[i - 1], b = M[i];
      // 가장 낮은 구간(20–12000Hz)은 귀가 듣는 방식대로 로그 눈금
      const t = i === 1 ? Math.log(hz / a[0]) / Math.log(b[0] / a[0]) : (hz - a[0]) / (b[0] - a[0]);
      return mixN(a[1], b[1], t);
    }
  }
  return 1;
}

function hzLabel(hz) {
  return hz >= 1000 ? (hz / 1000).toFixed(1) + ' kHz' : Math.round(hz) + ' Hz';
}

/* ───────────── 달팽이 받기 — 다른 서버에서 넘어오는 입구 ─────────────
   msg = { id, hz, image }   image: 달팽이 그림의 URL 또는 dataURL                */
function receiveSnail(msg) {
  msg = msg || {};
  // 청감 코드가 오면 이름표는 그 코드만 보여준다. 예: "ATV-LRB(17.2k/7)"
  const code = msg.code ?? msg.hearingCode ?? msg.label ?? null;
  const raw = msg.hz ?? msg.freq ?? msg.frequency ?? msg.value;
  let hz = Number.isFinite(Number(raw)) && raw != null ? Number(raw) : NaN;
  if (!Number.isFinite(hz) && typeof code === 'string') {
    // hz 가 따로 없으면 코드의 괄호 안 숫자에서 읽는다: (17.2k/7) → 17200Hz
    const m = code.match(/\((\d+(?:\.\d+)?)\s*(k?)/i);
    if (m) { hz = Number(m[1]) * (m[2] ? 1000 : 1); }
  }
  if (!Number.isFinite(hz)) { hz = 15000; }
  const src = msg.image || msg.img || msg.snail;
  if (typeof src === 'string' && src.length) {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => { addSnail(hz, im, msg.id, true).code = code; };
    im.onerror = () => { addSnail(hz, random(placeholders), msg.id, true).code = code; };
    im.src = src;
  } else {
    addSnail(hz, random(placeholders), msg.id, true).code = code;
  }
}

function snailHome(hz, id) {
  const center = clampN(1 - hzToUnit(hz), 0.015, 0.985);
  // 같은 ID는 새로고침하거나 대기 풀에서 돌아와도 같은 곳에 배치한다.
  let hash = 2166136261;
  for (const ch of id) hash = Math.imul(hash ^ ch.codePointAt(0), 16777619);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  const fraction = ((hash ^ (hash >>> 16)) >>> 0) / 2 ** 32;
  // 허용 범위를 먼저 자르면 꼭대기나 바닥에 여러 마리가 겹쳐 붙지 않는다.
  return mixN(Math.max(0.015, center - CFG.ARRIVAL_SPREAD),
    Math.min(0.985, center + CFG.ARRIVAL_SPREAD), fraction);
}

function addSnail(hz, img, id, viaPortal) {
  snailSeq++;
  const snailId = id == null ? 'SNAIL_' + String(snailSeq).padStart(2, '0') : String(id);
  const home = snailHome(hz, snailId);
  const sn = {
    id: snailId,
    hz, img, aspect: (img.height || 200) / (img.width || 300),
    home, s: home, target: home, dir: 1,
    speed: random(9, 18), pause: 0, ph: random(Math.PI * 2), sz: random(0.9, 1.1),
    portal: !!viaPortal, state: viaPortal ? 'portal' : 'live', born: millis() / 1000, reveal: viaPortal ? 0 : 1,
    seed: random(1000), code: null,
  };
  snails.push(sn);
  if (snails.length > CFG.MAX_SNAILS) { snails.shift(); }
  return sn;
}

function sendTestSnail(hz) {
  if (hz == null) {
    const r = random();
    hz = r < 0.7 ? random(12000, 19000) : r < 0.9 ? random(200, 12000) : random(19000, 20000);
  }
  receiveSnail({ hz, code: CFG.DEMO_CODES ? demoCode(hz) : null });
}

// 미리보기용 가짜 청감 코드 (실제 코드 형식이 정해지면 서버에서 온 값이 그대로 쓰인다)
function demoCode(hz) {
  const pick = str => str[Math.floor(random(str.length))];
  return 'A' + pick('TKMS') + pick('VNR') + '-' + pick('LR') + pick('RL') + pick('BAF') +
    '(' + (hz / 1000).toFixed(1) + 'k/' + Math.floor(random(1, 10)) + ')';
}

function snailLabel(sn) {
  return sn.code ? String(sn.code) : sn.id + ' ' + hzLabel(sn.hz);
}

function connectServer() {
  if (!CFG.SERVER_URL) { return; }
  try {
    ws = new WebSocket(CFG.SERVER_URL);
    ws.onmessage = e => { try { receiveSnail(JSON.parse(e.data)); } catch (err) { /* 형식이 다른 메시지는 건너뜀 */ } };
    ws.onclose = () => setTimeout(connectServer, 3000);
  } catch (err) {
    setTimeout(connectServer, 5000);
  }
}

function updateSnails(dt, now) {
  for (const sn of snails) {
    if (sn.state === 'portal') {
      const t = (now - sn.born) / CFG.PORTAL_SEC;
      sn.reveal = sstep(0.22, 0.62, t);
      if (t >= 0.7) { sn.state = 'live'; sn.reveal = 1; sn.pause = now + random(0.4, 1.4); }
      continue;
    }
    if (now < sn.pause) { continue; }
    const d = sn.target - sn.s;
    if (Math.abs(d) < 0.0015) {
      sn.pause = now + random(1.5, 5.5);
      sn.target = clampN(sn.home + random(-CFG.WANDER, CFG.WANDER), 0.015, 0.985);
      continue;
    }
    sn.dir = d > 0 ? 1 : -1;
    const a = helix(sn.s), b = helix(Math.min(1, sn.s + 0.002));
    const rate = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.002;
    sn.s += sn.dir * sn.speed * dt / rate;
    sn.ph += dt * 5;
    if (random() < dt * 5 && sparks.length < 260) {
      sparks.push({ p: [a[0] + random(-6, 6), a[1] + random(2, 16), a[2] + random(-6, 6)], vy: random(4, 16), life: 1, col: colorAt(sn.s) });
    }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const sp = sparks[i];
    sp.life -= dt * 0.7;
    sp.p[1] += sp.vy * dt;
    if (sp.life <= 0) { sparks.splice(i, 1); }
  }
}

function snailBase(sn) {
  const h = helix(sn.s);
  return [h[0], h[1] + 5, h[2]];
}

function drawSnail(sn, now, back) {
  const base = snailBase(sn);
  const p = project(base);
  const col = colorAt(sn.s);
  const moving = sn.state === 'live' && now >= sn.pause;
  const w = CFG.SNAIL_SIZE * sn.sz * (sn.art ? 1.5 : 1) * p[3] * (moving ? 1 + 0.04 * Math.sin(sn.ph) : 1) * mixN(0.3, 1, sn.reveal);
  const h = w * sn.aspect;
  const top = sn.art ? -h * SNAIL_ART.ground / SNAIL_ART.height : -h;
  const ahead = project(helix(clampN(sn.s + 0.004 * sn.dir, 0, 1)));
  const flip = (ahead[0] >= p[0]) !== CFG.SNAIL_FACES_RIGHT;
  const dim = back ? 0.5 : 1;

  ctx.globalCompositeOperation = 'lighter';
  // 발밑의 빛
  const halo = ctx.createRadialGradient(p[0], p[1] - h * 0.35, 0, p[0], p[1] - h * 0.35, w * 0.8);
  halo.addColorStop(0, rgba(col, 0.3 * sn.reveal * dim));
  halo.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(p[0] - w, p[1] - h * 0.35 - w, w * 2, w * 2);

  ctx.save();
  ctx.translate(p[0], p[1]);
  if (flip && !sn.art) { ctx.scale(-1, 1); }
  if (sn.art) {
    const nowMs = now * 1000;
    sn.art.renderSprite(nowMs);
    if (sn.state === 'live') {
      sn.art.updateSlime(nowMs);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = dim;
      ctx.translate(-w / 2, top);
      ctx.scale(w / SNAIL_ART.width, h / SNAIL_ART.height);
      sn.art.drawSlime(ctx, nowMs);
      ctx.restore();
    }
  }
  ctx.globalCompositeOperation = 'screen';
  if (sn.reveal < 1) {
    // 접속 중: 가로 줄 단위로 어긋나며 나타난다
    const rows = 14;
    const sh = sn.img.height / rows;
    for (let r = 0; r < rows; r++) {
      if (noise(sn.seed + r * 0.7, now * 9) > sn.reveal * 1.25) { continue; }
      const off = (noise(sn.seed + r * 1.3, now * 14) - 0.5) * w * 0.9 * (1 - sn.reveal);
      ctx.globalAlpha = dim * (0.5 + 0.5 * sn.reveal);
      ctx.drawImage(sn.img, 0, r * sh, sn.img.width, sh, -w / 2 + off, top + (r / rows) * h, w, h / rows + 0.6);
    }
  } else {
    ctx.globalAlpha = dim;
    ctx.drawImage(sn.img, -w / 2, top, w, h);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  sn.box = [p[0] - w / 2, p[1] + top, w, h];
}

/* ───────────── 포탈 ───────────── */
function drawPortal(sn, now) {
  const t = (now - sn.born) / CFG.PORTAL_SEC;
  if (t < 0 || t > 1) { return; }
  const open = t < 0.18 ? 1 - Math.pow(1 - t / 0.18, 3) : t > 0.72 ? 1 - sstep(0.72, 1, t) : 1;
  if (open <= 0.01) { return; }
  const base = snailBase(sn);
  const p = project([base[0], base[1] + CFG.SNAIL_SIZE * 0.42, base[2]]);
  const col = colorAt(sn.s);
  const R = CFG.SNAIL_SIZE * 0.86 * p[3] * open;
  const rx = R * 0.74, ry = R;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(p[0], p[1]);

  // 안쪽 빛과 주사선
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
  g.addColorStop(0, rgba(mul(col, 1.3), 0.5 * open));
  g.addColorStop(0.55, rgba(col, 0.2 * open));
  g.addColorStop(1, rgba(col, 0.02));
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
  ctx.fillStyle = rgba(col, 0.2);
  const gap = Math.max(3, R * 0.07);
  for (let y = -ry + ((now * 40) % gap); y < ry; y += gap) { ctx.fillRect(-rx, y, rx * 2, 1); }
  ctx.restore();

  // 고리 세 겹
  const ring = (k, w, a, dash, spin) => {
    ctx.setLineDash(dash);
    ctx.lineDashOffset = spin;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * k, ry * k, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(col, a * 0.2); ctx.lineWidth = w * 5; ctx.stroke();
    ctx.strokeStyle = rgba(mul(col, 1.3), a); ctx.lineWidth = w; ctx.stroke();
  };
  ring(1, 2, 0.95, [], 0);
  ring(1.16, 1.2, 0.7, [R * 0.22, R * 0.1], now * 60);
  ring(1.34, 1, 0.45, [R * 0.05, R * 0.16], -now * 40);
  ctx.setLineDash([]);

  // 빨려 들어오는 입자
  for (let i = 0; i < 26; i++) {
    const ph = (now * 0.9 + i * 0.137 + sn.seed) % 1;
    const a = i * 2.399 + ph * 5 + sn.seed;
    const rr = mixN(1.9, 0.15, ph);
    const s2 = Math.max(1, R * 0.035 * (1 - ph * 0.5));
    ctx.fillStyle = rgba(mul(col, 1.3), 0.85 * (1 - ph) * open);
    ctx.fillRect(Math.cos(a) * rx * rr - s2 / 2, Math.sin(a) * ry * rr - s2 / 2, s2, s2);
  }
  ctx.restore();

  // 접속 표시
  if (CFG.BOXES && t < 0.75) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = rgba(mul(col, 1.3), 0.9);
    const bar = Math.round(sstep(0.05, 0.62, t) * 8);
    ctx.fillText('CONNECT ' + '■'.repeat(bar) + '□'.repeat(8 - bar) + ' ' + (sn.code ? sn.code : hzLabel(sn.hz)), p[0], p[1] - ry * 1.4 - 4);
  }
}

function drawBoxes() {
  if (!CFG.BOXES) { return; }
  ctx.font = '500 11px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  for (const sn of snails) {
    if (sn.state !== 'live' || !sn.box || sn.hidden) { continue; }
    const b = sn.box;
    if (b[2] < 26) { continue; }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(CFG.LABEL_COLOR, 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(b[0] - 3, b[1] - 3, b[2] + 6, b[3] + 6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(CFG.LABEL_COLOR, 1);
    ctx.fillText(snailLabel(sn), b[0] - 3, b[1] - 6);
  }
}

/* ============================================================
   이스터에그 — 아날로그 다변기 부품 (네온 와이어프레임)
   나팔 · 몸통 · 공기 길 · 이어팁 끼우는 곳을 회전체 단면으로 그린다
   ============================================================ */
// [축 위의 위치 0=나팔 끝 … 1=노즐 끝, 반지름] — 둘 다 부품 길이에 대한 비율
const PART_PROFILE = [
  [0.00, 0.30], [0.03, 0.24], [0.08, 0.15], [0.15, 0.10], [0.21, 0.085],   // 나팔
  [0.24, 0.085], [0.24, 0.21], [0.26, 0.22], [0.66, 0.22], [0.68, 0.21],   // 몸통
  [0.68, 0.06], [0.93, 0.06],                                              // 공기 길
  [0.93, 0.072], [0.95, 0.072], [0.96, 0.06], [0.975, 0.072], [1.00, 0.06], // 이어팁 끼우는 곳
];
const PART_SEG = 14;

function rotateAround(v, k, ang) {
  const c = Math.cos(ang), sn = Math.sin(ang);
  const d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  return [
    v[0] * c + (k[1] * v[2] - k[2] * v[1]) * sn + k[0] * d * (1 - c),
    v[1] * c + (k[2] * v[0] - k[0] * v[2]) * sn + k[1] * d * (1 - c),
    v[2] * c + (k[0] * v[1] - k[1] * v[0]) * sn + k[2] * d * (1 - c),
  ];
}

function unit3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// 부품의 한 점: 축 a, 수직 축 u·v, 중심 c
function partPoint(c, a, u, v, L, z, r, phi) {
  const k = (z - 0.5) * L, cu = Math.cos(phi) * r * L, cv = Math.sin(phi) * r * L;
  return [c[0] + a[0] * k + u[0] * cu + v[0] * cv, c[1] + a[1] * k + u[1] * cu + v[1] * cv, c[2] + a[2] * k + u[2] * cu + v[2] * cv];
}

function addPart(falling) {
  const yaw = random(Math.PI * 2);
  const kind = random();
  // 놓이는 자세: 대부분 옆으로 누움, 가끔 나팔을 바닥에 대고 섬
  let a;
  if (kind < 0.72) { a = unit3([Math.cos(yaw), random(-0.12, 0.2), Math.sin(yaw)]); }
  else if (kind < 0.9) { a = unit3([Math.cos(yaw) * 0.25, 1, Math.sin(yaw) * 0.25]); }
  else { a = unit3([Math.cos(yaw) * 0.5, -0.8, Math.sin(yaw) * 0.5]); }
  const ref = Math.abs(a[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = unit3([a[1] * ref[2] - a[2] * ref[1], a[2] * ref[0] - a[0] * ref[2], a[0] * ref[1] - a[1] * ref[0]]);
  const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
  const L = CFG.PART_SIZE * random(0.8, 1.2);
  // 바닥에 닿도록 높이를 맞춘다
  let minY = Infinity;
  for (const pr of PART_PROFILE) {
    for (let i = 0; i < PART_SEG; i++) {
      const y = partPoint([0, 0, 0], a, u, v, L, pr[0], pr[1], (i / PART_SEG) * Math.PI * 2)[1];
      if (y < minY) { minY = y; }
    }
  }
  const ang = random(Math.PI * 2);
  const rad = TW.RB + random(90, 300);
  const p = {
    a, u, v, L, x: Math.cos(ang) * rad, z: Math.sin(ang) * rad, rest: -minY + 1,
    y: falling ? TW.H + random(120, 260) : 0, vy: 0, state: falling ? 'fall' : 'rest',
    spinAxis: unit3([random(-1, 1), random(-1, 1), random(-1, 1)]), spin: falling ? random(5, 9) : 0,
    col: mul(CFG.PART_COLOR, random(0.82, 1.08)), flash: 0, bounce: 0, ph: random(Math.PI * 2),
  };
  if (!falling) { p.y = p.rest; }
  parts.push(p);
  if (parts.length > CFG.MAX_PARTS) { parts.shift(); }
  return p;
}

function dropPart() { return addPart(true); }

function updateParts(dt, now) {
  if (CFG.PART_INTERVAL > 0 && now - lastPart > CFG.PART_INTERVAL) {
    lastPart = now;
    dropPart();
  }
  for (const p of parts) {
    if (p.state === 'fall') {
      p.vy -= 900 * dt;
      p.y += p.vy * dt;
      p.spin = Math.max(0, p.spin - dt * 1.1);
      if (p.y <= p.rest) {
        p.y = p.rest;
        if (p.bounce < 2 && p.vy < -120) {
          p.vy = -p.vy * 0.28;
          p.bounce++;
          p.flash = 1;
          p.spin *= 0.35;
        } else {
          p.state = 'rest';
          p.spin = 0;
          p.flash = Math.max(p.flash, 0.6);
        }
      }
    }
    p.flash = Math.max(0, p.flash - dt * 1.4);
  }
}

function drawPart(p, now, back) {
  let a = p.a, u = p.u, v = p.v;
  if (p.spin > 0) {
    // 떨어지는 동안은 구르다가, 바닥에 가까워질수록 놓일 자세로 돌아온다
    const ang = p.spin * (p.y - p.rest) * 0.012 + p.spin * 0.4 * Math.sin(now * 3 + p.ph);
    a = rotateAround(a, p.spinAxis, ang);
    u = rotateAround(u, p.spinAxis, ang);
    v = rotateAround(v, p.spinAxis, ang);
  }
  const c = [p.x, p.y, p.z];
  const rings = [];
  for (const pr of PART_PROFILE) {
    const ring = [];
    for (let i = 0; i < PART_SEG; i++) {
      ring.push(project(partPoint(c, a, u, v, p.L, pr[0], pr[1], (i / PART_SEG) * Math.PI * 2)));
    }
    rings.push(ring);
  }
  const zc = rings[8][0][2];
  const fade = mixN(1, 0.45, sstep(CAM.D - 300, CAM.D + 380, zc)) * (back ? 0.7 : 1);
  const flick = 0.82 + 0.18 * noise(p.ph, now * 1.7);       // 버려진 물건처럼 가끔 깜빡인다
  const alpha = (0.68 * flick + p.flash * 0.5) * fade;

  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  for (const ring of rings) {
    ctx.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < PART_SEG; i++) { ctx.lineTo(ring[i][0], ring[i][1]); }
    ctx.closePath();
  }
  for (let i = 0; i < PART_SEG; i += 2) {
    ctx.moveTo(rings[0][i][0], rings[0][i][1]);
    for (let j = 1; j < rings.length; j++) { ctx.lineTo(rings[j][i][0], rings[j][i][1]); }
  }
  ctx.strokeStyle = rgba(p.col, alpha * 0.22);
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = rgba(mul(p.col, 1.25), alpha);
  ctx.lineWidth = 0.9;
  ctx.stroke();

  if (p.flash > 0.02 && p.state !== 'fall' || p.flash > 0.5) {
    // 바닥에 부딪힐 때 퍼지는 고리
    const q = project([p.x, 1, p.z]);
    const r = (1 - p.flash) * 70 * q[3] + 6;
    ctx.beginPath();
    ctx.ellipse(q[0], q[1], r, r * 0.34, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(p.col, p.flash * 0.7);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

/* ============================================================
   p5 진입점
   ============================================================ */
function stageSize() {
  const host = document.getElementById('stage');
  let w = host ? host.clientWidth : windowWidth;
  let h = host ? host.clientHeight : windowHeight;
  if (!w || w < 50) { w = 600; }
  if (!h || h < 50) { h = Math.round(w * 1.25); }
  return { host, w, h };
}

function setup() {
  const sz = stageSize();
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  const c = createCanvas(sz.w, sz.h);
  if (sz.host) { c.parent(sz.host); }
  ctx = drawingContext;
  neonStops = CFG.PALETTE.map(neonify);
  buildLeaves();
  buildDots();
  for (let i = 0; i < 3; i++) { placeholders.push(makePlaceholder(i)); }
  // 포트: 임시 달팽이는 ?demo=1 일 때만 처음부터 접속해 있다
  for (const hz of CFG.DEMO ? [900, 9000, 14200, 16800, 18400] : []) {
    const sn = addSnail(hz, random(placeholders), null, false);
    sn.pause = random(0, 3);
    if (CFG.DEMO_CODES) { sn.code = demoCode(hz); }
  }
  for (let i = 0; i < CFG.PARTS_START; i++) { addPart(false); }
  lastPart = 4 - CFG.PART_INTERVAL;   // 첫 부품은 4초쯤 뒤에 떨어진다
  connectServer();
  if (window.towerReady) { window.towerReady(); }   // 포트: app.js가 피드를 시작
}

function draw() {
  ctx = drawingContext;
  const dt = Math.min(deltaTime, 60) / 1000;
  const now = millis() / 1000;
  if (orbitOn && !pressOnCanvas) { camA += CFG.ORBIT * dt; }
  updateView();

  if (CFG.DEMO && !CFG.SERVER_URL && demoSent < CFG.DEMO_MAX && now - lastDemo > CFG.DEMO_INTERVAL) {
    lastDemo = now;
    demoSent++;
    sendTestSnail();
  }
  updateSnails(dt, now);
  updateParts(dt, now);

  // 배경은 항상 검정
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(150,170,200,0.07)';
  for (let y = 13; y < height; y += 26) {
    for (let x = 13; x < width; x += 26) { ctx.fillRect(x, y, 1, 1); }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 기둥 뒤 / 앞으로 나눠 먼 것부터 그린다
  const items = [];
  for (const L of leaves) {
    const h = helix(L.s);
    const p = project(h);
    items.push({ kind: 0, o: L, zc: p[2], back: p[2] > axisDepth(h[1]) + 4 });
  }
  for (const sn of snails) {
    const b = snailBase(sn);
    const p = project(b);
    const back = p[2] > axisDepth(b[1]) + 4;
    sn.hidden = back;
    items.push({ kind: 1, o: sn, zc: p[2] - 6, back });
  }
  for (const pt of parts) {
    const p = project([pt.x, pt.y, pt.z]);
    items.push({ kind: 2, o: pt, zc: p[2], back: p[2] > axisDepth(pt.y) + 4 });
  }
  items.sort((a, b) => b.zc - a.zc);

  const paint = it => {
    if (it.kind === 0) { drawLeaf(it.o, now, it.back); return; }
    if (it.kind === 2) { drawPart(it.o, now, it.back); return; }
    if (it.o.portal && now - it.o.born < CFG.PORTAL_SEC) { drawPortal(it.o, now); }
    drawSnail(it.o, now, it.back);
  };
  for (const it of items) { if (it.back) { paint(it); } }
  drawPillar(now);
  for (const it of items) { if (!it.back) { paint(it); } }

  // 달팽이가 지나간 자리의 빛가루
  ctx.globalCompositeOperation = 'lighter';
  for (const sp of sparks) {
    const p = project(sp.p);
    const s2 = Math.max(1, p[3] * 2.2);
    ctx.fillStyle = rgba(mul(sp.col, 1.3), sp.life * 0.8);
    ctx.fillRect(p[0] - s2 / 2, p[1] - s2 / 2, s2, s2);
  }

  drawBoxes();

  if (CFG.LABELS) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    const t = project([0, TW.H + 46, 0]);
    ctx.fillStyle = rgba(neonStops[9], 0.9);
    ctx.fillText('20 kHz · 높은 소리', t[0], Math.max(14, t[1]));
    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(neonStops[1], 0.85);
    ctx.fillText('20 Hz · 낮은 소리', width - 16, height - 16);
  }
  ctx.globalCompositeOperation = 'source-over';
  if (window.towerOverlay) { window.towerOverlay(now); }   // 포트: 무대 교체·디버그 (app.js)
}

function towerStatus() {
  let live = 0, joining = 0;
  for (const sn of snails) { if (sn.state === 'live') { live++; } else { joining++; } }
  return '접속한 달팽이 ' + live + ' · 접속 중 ' + joining + ' · 바닥의 다변기 부품 ' + parts.length;
}

function windowResized() {
  const sz = stageSize();
  resizeCanvas(sz.w, sz.h);
}

function mousePressed(e) {
  if (!CFG.DEFAULT_CONTROLS) return;
  if (e && e.target && !e.target.closest?.('#stage canvas')) { pressOnCanvas = false; return; }   // 포트: 디버그 창을 누를 때는 타워를 돌리지 않음
  pressOnCanvas = mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
  dragMoved = 0;
}

function mouseDragged() {
  if (!CFG.DEFAULT_CONTROLS) return;
  if (!pressOnCanvas) { return; }
  camA += (mouseX - pmouseX) * 0.006;
  dragMoved += Math.abs(mouseX - pmouseX);
}

function mouseReleased() {
  if (!CFG.DEFAULT_CONTROLS) return;
  if (CFG.DEMO && pressOnCanvas && dragMoved < 6) { sendTestSnail(); }
  pressOnCanvas = false;
}

function keyPressed(event) {
  if (!CFG.DEFAULT_CONTROLS) return;
  if (event?.target?.tagName === 'SELECT') {
    if (key === 'd' || key === 'D') {
      event.target.blur();
      window.towerKey?.(key);
      return false;
    }
    return;
  }
  if (window.towerKey) { window.towerKey(key); }   // 포트: D 디버그 창, F 전체화면, R 비우기 (app.js)
  if (document.activeElement && document.activeElement.tagName === 'BUTTON') { document.activeElement.blur(); }
  if (key === ' ') { if (CFG.DEMO) { sendTestSnail(); } return false; }
  if (key === 'b' || key === 'B') { CFG.BOXES = !CFG.BOXES; }
  else if (key === 'o' || key === 'O') { orbitOn = !orbitOn; }
  else if (key === 'p' || key === 'P') { dropPart(); }   // 포트: D는 디버그 창이라 P로 옮김
}
