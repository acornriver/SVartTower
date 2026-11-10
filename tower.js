// noprotect
// ============================================================
// 청감 타워 (Hearing Tower) — p5.js 1.x 용 (1.9.4 권장, 2.x 에서는 일부 기능이 다를 수 있음)
//
// 구조: 메인 캔버스가 WEBGL(3D 타워). 배경지·날씨·필름 그레인은 2D 레이어 두 장
//       (bgL = 타워 뒤, fxL = 타워 앞)에 그려 3D 공간의 앞뒤에 판으로 세운다.
//       달팽이는 3D 공간 안의 평면 스티커(빌보드)로 그린다.
//       p5 1.x / 2.x 모두에서 돌도록 3D 는 전역 함수만 쓴다.
//
// 원본: ref/tower.js (실제 비주얼). 이 파일은 그 포트이고, 달팽이는 app.js가 피드에서 받아
//       snail-sticker.js로 그린 스티커를 넘긴다 (towerAddSnail). 바꾼 곳은 '포트:' 주석.
// 조작: 드래그 = 타워 돌리기. ?demo=1 이면 클릭/스페이스 = 테스트 달팽이 보내기
//       1 맑음  2 흐림  3 비  4 눈  5 안개  0 실시간 날씨
//       T 시간대 바꾸기   O 자동 회전 켜기/끄기   H 상태 표시
// ============================================================
p5.disableFriendlyErrors = true;

/* ───────────── 조절값 ───────────── */
const CFG = {
  SERVER_URL: '',            // 예: 'wss://내서버/snails' — 비워두면 데모 모드
  DEMO: location.search.includes('demo=1'), // 포트: ?demo=1 일 때만 임시 달팽이를 자동으로 보냄
  DEMO_INTERVAL: 7,          // 초
  DEMO_MAX: 9,               // 자동으로 보내는 마릿수

  // 주파수(Hz) → 타워 높이(0=바닥, 1=꼭대기). 12000–19000Hz 구간을 크게 벌린다.
  FREQ_MAP: [[20, 0.00], [12000, 0.30], [19000, 0.92], [20000, 1.00]],

  WANDER: 0.14,              // 달팽이가 제자리에서 벗어나 돌아다니는 범위 (둘레길 전체 = 1)
  SNAIL_SIZE: 52,            // 달팽이 스티커 가로 크기 (타워 높이 540 기준)
  SNAIL_FACES_RIGHT: true,   // 넘어오는 달팽이 그림이 오른쪽을 보고 있으면 true
  MAX_SNAILS: 60,
  MAX_PLANES: 140,           // 바닥에 남겨두는 종이비행기 수
  FLIGHT_SEC: 8,             // 종이비행기가 날아오는 시간
  ORBIT: 0.03,               // 자동 회전 속도 (rad/s), 0 이면 정지
  GRAIN: 0.07,               // 필름 그레인 세기. 포트: 원본 0.16이 너무 거칠어 낮춤 (11/10 사용자 요청, 값은 Claude가 정함)
  GRAIN_HOLD: 4,             // 포트: 그레인 무늬를 바꾸는 간격(프레임). 원본 2는 지글거려 보여 늘림

  WEATHER_URL: 'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978' +
    '&current=temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m' +
    '&timezone=Asia%2FSeoul',
  WEATHER_REFRESH_MIN: 10,

  COL: {
    clay: [150, 152, 132],   // 타워
    fence: [226, 118, 62],   // 둘레길 울타리
    screw: [236, 228, 204],  // 나사
    plane: [42, 92, 160],    // 종이비행기
    table: [226, 206, 172],  // 바닥
  },
};

/* ───────────── 타워 치수 ───────────── */
const T = { H: 540, TURNS: 3.2, INSET: 0.68, RB: 128, RT: 62, NU: 120, ROWS: 34, TH0: -Math.PI / 2, RAIL: 13 };
const W_MIN = 0.2;
const W_MAX = T.TURNS + 0.95;
const TABLE_R = 1300;

// 파낸 홈. u = 둘레 위치(0–1, 0.5가 정면), s = 나선 좌표(정수 = 둘레길 높이)
const CAVITIES = [
  { u: 0.430, s: 0.50, ru: 0.075, rs: 0.27, depth: 0.42, irr: 0.30, ribs: 26, seed: 11 },
  { u: 0.585, s: 0.47, ru: 0.058, rs: 0.25, depth: 0.38, irr: 0.34, ribs: 22, seed: 23 },
  { u: 0.400, s: 1.52, ru: 0.085, rs: 0.28, depth: 0.44, irr: 0.28, ribs: 30, seed: 37 },
  { u: 0.565, s: 1.46, ru: 0.050, rs: 0.22, depth: 0.32, irr: 0.36, ribs: 18, seed: 41 },
  { u: 0.490, s: 2.36, ru: 0.070, rs: 0.22, depth: 0.40, irr: 0.30, ribs: 24, seed: 53 },
  { u: 0.205, s: 0.55, ru: 0.070, rs: 0.26, depth: 0.40, irr: 0.32, ribs: 24, seed: 61 },
  { u: 0.800, s: 1.50, ru: 0.080, rs: 0.27, depth: 0.42, irr: 0.30, ribs: 28, seed: 73 },
  { u: 0.820, s: 0.46, ru: 0.060, rs: 0.24, depth: 0.36, irr: 0.34, ribs: 20, seed: 83 },
  { u: 0.215, s: 1.50, ru: 0.065, rs: 0.25, depth: 0.38, irr: 0.30, ribs: 22, seed: 97 },
  { u: 0.500, s: -0.27, ru: 0.050, rs: 0.15, depth: 0.10, irr: 0.40, ribs: 14, seed: 101 },
  { u: 0.640, s: -0.20, ru: 0.045, rs: 0.13, depth: 0.09, irr: 0.40, ribs: 12, seed: 113 },
];

/* ───────────── 상태 ───────────── */
let bgL, fxL;   // 2D 레이어: 타워 뒤 / 타워 앞
let towerGeom, domeGeom, fenceGeom, tableGeom;
let towerTex, domeTex, tableTex, paperImg, grainImg, vignetteImg, blobImg, fogImg;
let placeholderStickers = [];
let snails = [];     // 타워 위를 기어다니는 달팽이
let arrivals = [];   // 종이비행기를 타고 오는 중
let falling = [];    // 떨어지는 종이비행기
let pile = [];       // 바닥에 쌓인 종이비행기
let particles = [];
let particleKey = '';
let cam = {};
let look = null;
let camA = 0;
let orbitOn = true;
let hud = false;
let weatherLive = null;
let weatherOverride = null;
let hourOverride = null;
let lastDemo = -3;
let demoSent = 0;
let snailSeq = 0;
let flash = 0;
let nextFlash = 5;
let pressOnCanvas = false;
let dragMoved = 0;
let grainOX = 0;
let grainOY = 0;
let ws = null;

/* ───────────── 벡터 도우미 ───────────── */
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len3 = a => Math.hypot(a[0], a[1], a[2]);
const norm3 = a => { const l = len3(a); return l < 1e-9 ? [0, 1, 0] : [a[0] / l, a[1] / l, a[2] / l]; };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clampN = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clampN((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mixN = (a, b, t) => a + (b - a) * t;

/* ============================================================
   타워 형태
   ============================================================ */
function axisAt(v) {
  return [26 * Math.sin(v * 3.5 + 0.3) - 12 * v, 9 * Math.sin(v * 2.7 + 1.0)];
}

function rcore(v) {
  return mixN(T.RB, T.RT, Math.pow(v, 0.85)) * (1 + 0.07 * Math.sin(v * 8.5 + 0.8));
}

function cavityAt(u, s) {
  let best = null;
  for (const c of CAVITIES) {
    const du = (u - c.u) / c.ru;
    const ds = (s - c.s) / c.rs;
    const q = du * du + ds * ds;
    if (q > 2.2) continue;
    const ang = Math.atan2(ds, du);
    const edge = 1 + c.irr * (noise(c.seed + Math.cos(ang) * 1.1 + 2, c.seed + Math.sin(ang) * 1.1 + 2) - 0.5) * 2 +
      0.12 * Math.sin(ang * 3 + c.seed);
    const d = Math.sqrt(q) / edge;
    if (d < 1 && (!best || d < best.d)) best = { d, ang, c };
  }
  return best;
}

function radiusAt(u, v, p, s, useCav) {
  const th = T.TH0 + Math.PI * 2 * u;
  const wob = 1 + 0.09 * (noise(3 + Math.cos(th) * 0.9, 3 + Math.sin(th) * 0.9, v * 3.2) - 0.5);
  const rc = rcore(v);
  let r = rc * (T.INSET + (1 - T.INSET) * Math.pow(p, 1.5)) * wob;
  if (useCav && v > 0.001 && v < 0.999) {
    const c = cavityAt(u, s);
    if (c) r -= rc * c.c.depth * (1 - Math.pow(c.d, 2.5));
  }
  return Math.max(r, rc * 0.2);
}

// 나선 좌표 (u, s) → 3D 점. p 는 한 바퀴 안에서의 위치 (0 = 둘레길 바로 위, 1 = 다음 둘레길 턱)
function surfacePoint(u, s, p) {
  const v = clampN((s + u) / T.TURNS, 0, 1);
  const th = T.TH0 + Math.PI * 2 * u;
  const r = radiusAt(u, v, p, s, true);
  const a = axisAt(v);
  return [a[0] + r * Math.cos(th), v * T.H, a[1] + r * Math.sin(th)];
}

// 둘레길 바깥 턱. w = 둘레길을 따라가는 값 (0 = 바닥, TURNS = 꼭대기, 그 위는 꼭대기 한 바퀴)
function lipPoint(w, inset) {
  const m = Math.floor(w);
  const u = w - m;
  const v = clampN(w / T.TURNS, 0, 1);
  const th = T.TH0 + Math.PI * 2 * u;
  const r = radiusAt(u, v, 1, 0, false) - (inset || 0);
  const a = axisAt(v);
  return [a[0] + r * Math.cos(th), v * T.H, a[1] + r * Math.sin(th), th, r];
}

function railPoint(w) {
  const b = lipPoint(w, 3);
  return [b[0], b[1] + T.RAIL, b[2]];
}

/* ───────────── 지오메트리 만들기 ───────────── */
function makeGeom(id, build) {
  const g = new p5.Geometry(1, 1, function () { build(this); });
  g.gid = id;
  return g;
}

// 내부 좌표는 y 가 위쪽. p5 는 y 가 아래쪽이라 여기서 뒤집는다.
function gv(g, p, n, u, v) {
  g.vertices.push(createVector(p[0], -p[1], p[2]));
  g.vertexNormals.push(createVector(n[0], -n[1], n[2]));
  g.uvs.push(u, v);
  return g.vertices.length - 1;
}

function buildTower() {
  const NU = T.NU;
  const M = T.ROWS;
  const kMin = -1;
  const kMax = Math.ceil(T.TURNS) - 1;
  return makeGeom('hearing-tower', g => {
    const strips = [];
    for (let k = kMin; k <= kMax; k++) {
      const P = [];
      for (let j = 0; j <= M; j++) {
        const row = [];
        const p = j / M;
        for (let i = 0; i <= NU; i++) row.push(surfacePoint(i / NU, k + p, p));
        P.push(row);
      }
      const base = g.vertices.length;
      for (let j = 0; j <= M; j++) {
        for (let i = 0; i <= NU; i++) {
          const a = P[j][Math.max(i - 1, 0)];
          const b = P[j][Math.min(i + 1, NU)];
          const c = P[Math.max(j - 1, 0)][i];
          const d = P[Math.min(j + 1, M)][i];
          let n = cross3(sub3(b, a), sub3(d, c));
          n = len3(n) < 1e-6 ? [0, 1, 0] : norm3(n);
          const th = T.TH0 + Math.PI * 2 * i / NU;
          if (n[0] * Math.cos(th) + n[2] * Math.sin(th) + n[1] * 0.35 < 0) n = mul3(n, -1);
          const u = i / NU;
          const v = clampN((k + j / M + u) / T.TURNS, 0, 1);
          gv(g, P[j][i], n, u, 1 - v);
        }
      }
      for (let j = 0; j < M; j++) {
        for (let i = 0; i < NU; i++) {
          const a = base + j * (NU + 1) + i;
          const b = a + 1;
          const c = a + (NU + 1) + 1;
          const d = a + (NU + 1);
          g.faces.push([a, b, c], [a, c, d]);
        }
      }
      strips.push(P);
    }
    // 둘레길 바닥
    for (let n = 0; n < strips.length - 1; n++) {
      const lower = strips[n][M];
      const upper = strips[n + 1][0];
      const base = g.vertices.length;
      for (let i = 0; i <= NU; i++) {
        const u = i / NU;
        const v = clampN((kMin + n + 1 + u) / T.TURNS, 0, 1);
        gv(g, lower[i], [0, 1, 0], u, 1 - v);
        gv(g, upper[i], [0, 1, 0], u, 1 - v);
      }
      for (let i = 0; i < NU; i++) {
        const a = base + i * 2;
        g.faces.push([a, a + 2, a + 3], [a, a + 3, a + 1]);
      }
    }
    // 꼭대기 뚜껑
    const ax = axisAt(1);
    const ci = gv(g, [ax[0], T.H - 0.8, ax[1]], [0, 1, 0], 0.5, 0.01);
    const ring = g.vertices.length;
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const th = T.TH0 + Math.PI * 2 * u;
      const r = radiusAt(u, 1, 1, 0, false);
      gv(g, [ax[0] + r * Math.cos(th), T.H - 0.8, ax[1] + r * Math.sin(th)], [0, 1, 0], u, 0.01);
    }
    for (let i = 0; i < NU; i++) g.faces.push([ci, ring + i, ring + i + 1]);
  });
}

function buildDome() {
  const LA = 10;
  const LO = 24;
  const ax = axisAt(1);
  const rx = rcore(1) * T.INSET * 0.6;
  const ry = rx * 1.25;
  return makeGeom('hearing-dome', g => {
    for (let j = 0; j <= LA; j++) {
      const phi = (j / LA) * Math.PI / 2;
      for (let i = 0; i <= LO; i++) {
        const th = (i / LO) * Math.PI * 2;
        const wob = 1 + 0.08 * (noise(9 + Math.cos(th), 9 + Math.sin(th), j * 0.3) - 0.5);
        const n = [Math.cos(phi) * Math.cos(th), Math.sin(phi), Math.cos(phi) * Math.sin(th)];
        gv(g, [ax[0] + n[0] * rx * wob, T.H - 2 + n[1] * ry * wob, ax[1] + n[2] * rx * wob], n, i / LO, j / LA);
      }
    }
    for (let j = 0; j < LA; j++) {
      for (let i = 0; i < LO; i++) {
        const a = j * (LO + 1) + i;
        g.faces.push([a, a + 1, a + LO + 2], [a, a + LO + 2, a + LO + 1]);
      }
    }
  });
}

function addBeam(g, A, B, wd) {
  const dir = sub3(B, A);
  const dn = norm3(dir);
  const ref = Math.abs(dn[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const s1 = norm3(cross3(dn, ref));
  const s2 = norm3(cross3(dn, s1));
  const base = g.vertices.length;
  const offs = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (const end of [A, B]) {
    for (const o of offs) {
      const n = norm3(add3(mul3(s1, o[0]), mul3(s2, o[1])));
      gv(g, add3(end, mul3(n, wd * 1.414)), n, 0, 0);
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = base + i;
    const b = base + (i + 1) % 4;
    g.faces.push([a, b, b + 4], [a, b + 4, a + 4]);
  }
}

function buildFence() {
  return makeGeom('hearing-fence', g => {
    let w = 0.14;
    let prev = null;
    while (w < T.TURNS + 1.0) {
      const b = lipPoint(w, 3);
      const h = T.RAIL + 3 + random(-1.6, 2.4);
      const foot = [b[0], b[1] - 1, b[2]];
      const top = [b[0] + random(-1.2, 1.2), b[1] + h, b[2] + random(-1.2, 1.2)];
      addBeam(g, foot, top, 0.7);
      const rp = mix3(foot, top, (T.RAIL + 1) / (h + 1));
      if (prev) addBeam(g, prev, rp, 0.6);
      prev = rp;
      w += (8.4 / (Math.PI * 2 * Math.max(b[4], 20))) * random(0.78, 1.25);
    }
  });
}

function buildTable() {
  return makeGeom('hearing-table', g => {
    const N = 72;
    const c = gv(g, [0, -1, 0], [0, 1, 0], 0.5, 0.5);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      gv(g, [Math.cos(a) * TABLE_R, -1, Math.sin(a) * TABLE_R], [0, 1, 0], 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (let i = 0; i < N; i++) g.faces.push([c, c + 1 + i, c + 2 + i]);
  });
}

/* ============================================================
   손으로 칠한 듯한 텍스처
   ============================================================ */
function paintPlaster(pg, W, Hh, base, n) {
  pg.background(base[0], base[1], base[2]);
  pg.noStroke();
  for (let i = 0; i < n * 0.1; i++) {
    const d = random(-16, 16);
    pg.fill(base[0] + d, base[1] + d, base[2] + d * 0.8, 22);
    pg.ellipse(random(W), random(Hh), random(60, 280), random(40, 170));
  }
  for (let i = 0; i < n; i++) {
    const x = random(W);
    const y = random(Hh);
    const a = (noise(x * 0.004, y * 0.004) - 0.5) * 5 + random(-0.3, 0.3);
    const l = random(12, 58);
    const d = random(-24, 20);
    pg.stroke(base[0] + d, base[1] + d, base[2] + d * 0.8, random(16, 40));
    pg.strokeWeight(random(0.8, 5));
    pg.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l);
  }
  pg.noStroke();
  for (let i = 0; i < n * 0.3; i++) {
    pg.fill(40, 40, 30, random(20, 70));
    pg.circle(random(W), random(Hh), random(0.6, 2.2));
  }
}

function buildTowerTexture() {
  const W = 1024;
  const Hh = 1024;
  const pg = createGraphics(W, Hh);
  pg.pixelDensity(1);
  paintPlaster(pg, W, Hh, CFG.COL.clay, 3200);

  // 균열
  pg.noFill();
  for (let i = 0; i < 5; i++) {
    let x = random(W);
    let y = random(Hh * 0.15, Hh * 0.85);
    pg.stroke(52, 54, 44, 150);
    pg.strokeWeight(random(1, 2.2));
    pg.beginShape();
    const n = Math.floor(random(8, 20));
    for (let j = 0; j < n; j++) {
      pg.vertex(x, y);
      x += random(-9, 9);
      y += random(4, 13);
    }
    pg.endShape();
  }

  // 아이보리 나사
  let placed = 0;
  let tries = 0;
  while (placed < 9 && tries++ < 600) {
    const u = random(0.05, 0.95);
    const v = random(0.05, 0.93);
    const s = v * T.TURNS - u;
    const p = s - Math.floor(s);
    if (p < 0.24 || p > 0.78) continue;
    if (cavityAt(u, s) || cavityAt(u + 0.03, s) || cavityAt(u - 0.03, s) || cavityAt(u, s + 0.08) || cavityAt(u, s - 0.08)) continue;
    const x = u * W;
    const y = (1 - v) * Hh;
    const sc = CFG.COL.screw;
    pg.noStroke();
    pg.fill(40, 40, 30, 90);
    pg.circle(x + 1.2, y + 1.8, 16);
    pg.fill(sc[0], sc[1], sc[2]);
    pg.circle(x, y, 13);
    pg.fill(sc[0] - 26, sc[1] - 28, sc[2] - 34);
    pg.circle(x, y, 5.4);
    pg.stroke(sc[0] - 70, sc[1] - 72, sc[2] - 76);
    pg.strokeWeight(1.1);
    const a = random(Math.PI);
    pg.line(x - Math.cos(a) * 2.4, y - Math.sin(a) * 2.4, x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4);
    placed++;
  }

  // 홈의 그늘·결, 둘레길 아래 그늘
  const ow = 512;
  const oh = 512;
  const ov = createImage(ow, oh);
  ov.loadPixels();
  const px = ov.pixels;
  for (let j = 0; j < oh; j++) {
    const v = 1 - (j + 0.5) / oh;
    for (let i = 0; i < ow; i++) {
      const u = (i + 0.5) / ow;
      const s = v * T.TURNS - u;
      const p = s - Math.floor(s);
      let m = 1 - 0.3 * Math.exp(-p * 15) - 0.1 * sstep(0.82, 1, p);
      const c = cavityAt(u, s);
      if (c) {
        if (c.d > 0.93) {
          m *= 1.08;
        } else {
          const kk = 1 - c.d;
          const rib = Math.sin(c.ang * c.c.ribs + noise(c.c.seed + c.d * 3, c.c.seed * 0.7) * 6);
          m *= mixN(0.9, 0.46, Math.pow(kk, 0.6)) * (1 + 0.1 * rib * Math.min(1, kk * 4));
        }
      }
      const idx = 4 * (j * ow + i);
      if (m < 1) {
        px[idx] = 22; px[idx + 1] = 24; px[idx + 2] = 16;
        px[idx + 3] = clampN((1 - m) * 255, 0, 235);
      } else {
        px[idx] = 255; px[idx + 1] = 250; px[idx + 2] = 232;
        px[idx + 3] = clampN((m - 1) * 255 * 1.6, 0, 120);
      }
    }
  }
  ov.updatePixels();
  pg.image(ov, 0, 0, W, Hh);
  const im = pg.get();
  pg.remove();
  return im;
}

function buildDomeTexture() {
  const pg = createGraphics(256, 256);
  pg.pixelDensity(1);
  paintPlaster(pg, 256, 256, CFG.COL.clay, 500);
  const im = pg.get();
  pg.remove();
  return im;
}

function buildTableTexture() {
  const W = 2048;
  const Hh = 2048;
  const pg = createGraphics(W, Hh);
  pg.pixelDensity(1);
  paintPlaster(pg, W, Hh, CFG.COL.table, 7000);
  pg.noStroke();
  for (let i = 0; i < 9000; i++) {
    const d = random() < 0.5 ? 255 : 90;
    pg.fill(d, d * 0.95, d * 0.85, random(30, 90));
    pg.circle(random(W), random(Hh), random(0.8, 2.6));
  }
  // 타워 밑의 부드러운 접지 그림자
  const k = W / (TABLE_R * 2);
  const ax = axisAt(0);
  const cx = W / 2 + ax[0] * k;
  const cy = Hh / 2 + ax[1] * k;
  for (let i = 0; i < 40; i++) {
    const r = mixN(250, 105, i / 39) * k;
    pg.fill(44, 36, 26, 6);
    pg.ellipse(cx, cy, r * 2, r * 2);
  }
  const im = pg.get();
  pg.remove();
  return im;
}

// 구겨진 배경지 (하늘색과 곱해진다)
function buildPaper() {
  const S = 900;
  const pg = createGraphics(S, S);
  pg.pixelDensity(1);
  pg.background(238, 240, 236);
  pg.noStroke();
  for (let i = 0; i < 120; i++) {
    const cx = random(S);
    const cy = random(S);
    const r = random(70, 300);
    const g = random() < 0.5 ? random(160, 205) : 255;
    pg.fill(g, g, g, random(14, 34));
    pg.beginShape();
    const n = Math.floor(random(3, 6));
    const a0 = random(Math.PI * 2);
    for (let j = 0; j < n; j++) {
      const a = a0 + (j / n) * Math.PI * 2 + random(-0.4, 0.4);
      const rr = r * random(0.5, 1);
      pg.vertex(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    pg.endShape(CLOSE);
  }
  for (let i = 0; i < 70; i++) {
    let x = random(S);
    let y = random(S);
    let a = random(Math.PI * 2);
    const segs = Math.floor(random(2, 5));
    for (let j = 0; j < segs; j++) {
      const l = random(40, 170);
      const nx = x + Math.cos(a) * l;
      const ny = y + Math.sin(a) * l;
      pg.stroke(255, 255, 255, 130);
      pg.strokeWeight(1);
      pg.line(x, y, nx, ny);
      pg.stroke(110, 116, 112, 60);
      pg.strokeWeight(1.6);
      pg.line(x + 1.4, y + 1.6, nx + 1.4, ny + 1.6);
      x = nx; y = ny;
      a += random(-0.9, 0.9);
    }
  }
  const im = pg.get();
  pg.remove();
  return im;
}

function buildGrain() {
  const im = createImage(256, 256);
  im.loadPixels();
  for (let i = 0; i < 256 * 256; i++) {
    const n = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;   // -1 ~ 1
    const g = n > 0 ? 255 : 0;
    im.pixels[i * 4] = g; im.pixels[i * 4 + 1] = g; im.pixels[i * 4 + 2] = g;
    im.pixels[i * 4 + 3] = Math.min(255, Math.abs(n) * 255 * CFG.GRAIN * 1.5);
  }
  im.updatePixels();
  return im;
}

function radialImage(S, stops) {
  const pg = createGraphics(S, S);
  pg.pixelDensity(1);
  pg.clear();
  const ctx = pg.drawingContext;
  const gr = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  for (const st of stops) gr.addColorStop(st[0], st[1]);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, S, S);
  const im = pg.get();
  pg.remove();
  return im;
}

/* ============================================================
   달팽이 스티커 — 넘어온 그림은 그대로 두고 칼선(흰 여백)만 두른다
   ============================================================ */
function dilateGrid(src, gw, gh, r) {
  const out = new Uint8Array(gw * gh);
  const offs = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r + 0.5) { offs.push([dx, dy]); }
    }
  }
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (!src[y * gw + x]) continue;
      for (const o of offs) {
        const xx = x + o[0];
        const yy = y + o[1];
        if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) out[yy * gw + xx] = 1;
      }
    }
  }
  return out;
}

// 바깥에서 닿지 않는 빈칸을 채운다 (달팽이 몸 안쪽을 한 장의 종이로)
function fillHoles(grid, gw, gh) {
  const outside = new Uint8Array(gw * gh);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= gw || y >= gh) return;
    const i = y * gw + x;
    if (grid[i] || outside[i]) return;
    outside[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < gw; x++) { push(x, 0); push(x, gh - 1); }
  for (let y = 0; y < gh; y++) { push(0, y); push(gw - 1, y); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % gw;
    const y = (i - x) / gw;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  const out = new Uint8Array(gw * gh);
  for (let i = 0; i < out.length; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

function makeSticker(img) {
  const S = 230;
  const pad = 26;
  const cell = 3;
  const border = 7;
  const k = S / Math.max(img.width, img.height);
  const iw = Math.max(8, Math.round(img.width * k));
  const ih = Math.max(8, Math.round(img.height * k));
  const W = iw + pad * 2;
  const Hh = ih + pad * 2;

  const src = createGraphics(W, Hh);
  src.pixelDensity(1);
  src.clear();
  src.image(img, pad, pad, iw, ih);
  src.loadPixels();
  const px = src.pixels;

  // 그림의 배경: 투명이면 알파로, 불투명이면 모서리 색과의 차이로 가려낸다
  const c0 = 4 * ((pad + 1) * W + pad + 1);
  const bg = [px[c0], px[c0 + 1], px[c0 + 2], px[c0 + 3]];
  const byAlpha = bg[3] < 24;
  const gw = Math.ceil(W / cell);
  const gh = Math.ceil(Hh / cell);
  const ink = new Uint8Array(gw * gh);
  let any = false;
  for (let y = pad; y < pad + ih; y++) {
    for (let x = pad; x < pad + iw; x++) {
      const i = 4 * (y * W + x);
      let on = px[i + 3] > 40;
      if (on && !byAlpha) {
        on = Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]) > 70;
      }
      if (on) {
        ink[((y / cell) | 0) * gw + ((x / cell) | 0)] = 1;
        any = true;
      }
    }
  }
  if (!any) {
    for (let y = pad; y < pad + ih; y += cell) {
      for (let x = pad; x < pad + iw; x += cell) { ink[((y / cell) | 0) * gw + ((x / cell) | 0)] = 1; }
    }
  }
  const body = fillHoles(dilateGrid(ink, gw, gh, 3), gw, gh);

  const cells = [];
  let maxRow = 0;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (body[y * gw + x]) {
        cells.push([(x + 0.5) * cell, (y + 0.5) * cell]);
        if (y > maxRow) maxRow = y;
      }
    }
  }

  const R = cell * 0.95;
  const st = createGraphics(W, Hh);
  st.pixelDensity(1);
  st.clear();
  st.noStroke();
  st.fill(118, 116, 110);                       // 칼선의 얇은 그늘
  for (const c of cells) st.circle(c[0], c[1], (R + border + 0.9) * 2);
  st.fill(252, 250, 244);                       // 흰 여백
  for (const c of cells) st.circle(c[0], c[1], (R + border) * 2);

  const m = createGraphics(W, Hh);
  m.pixelDensity(1);
  m.clear();
  m.noStroke();
  m.fill(255);
  for (const c of cells) m.circle(c[0], c[1], R * 2 + 1);

  const srcImg = src.get();
  const mImg = m.get();
  srcImg.mask(mImg);                            // 원본 픽셀은 손대지 않고 모양대로 오려내기만 한다
  st.image(srcImg, 0, 0);
  const out = st.get();
  src.remove();
  m.remove();
  st.remove();
  return { img: out, aspect: Hh / W, foot: clampN(((maxRow + 1) * cell + border) / Hh, 0.3, 1) };
}

/* ───────────── 데모용 임시 달팽이 (실제로는 서버에서 온 그림으로 대체) ───────────── */
function chaikin(pts, iters, closed) {
  let P = pts;
  for (let it = 0; it < iters; it++) {
    const Q = [];
    const n = P.length;
    const last = closed ? n : n - 1;
    if (!closed) Q.push(P[0]);
    for (let i = 0; i < last; i++) {
      const a = P[i];
      const b = P[(i + 1) % n];
      Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      Q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) Q.push(P[n - 1]);
    P = Q;
  }
  if (closed) P = P.concat([P[0]]);
  return P;
}

function densify(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function braid(pg, pts, col) {
  const A = [];
  const B = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[Math.min(i + 1, pts.length - 1)];
    const o = pts[Math.max(i - 1, 0)];
    let tx = q[0] - o[0];
    let ty = q[1] - o[1];
    const L = Math.hypot(tx, ty) || 1;
    tx /= L; ty /= L;
    if (i > 0) acc += Math.hypot(p[0] - o[0], p[1] - o[1]);
    const off = Math.sin(acc * 0.5) * 2.6;
    A.push([p[0] - ty * off, p[1] + tx * off]);
    B.push([p[0] + ty * off, p[1] - tx * off]);
  }
  pg.noFill();
  for (const pass of [[5, 38], [1.6, 235]]) {
    pg.stroke(col[0], col[1], col[2], pass[1]);
    pg.strokeWeight(pass[0]);
    for (const S of [A, B]) {
      pg.beginShape();
      for (const p of S) pg.vertex(p[0], p[1]);
      pg.endShape();
    }
  }
}

function placeholderSnail(variant) {
  const pg = createGraphics(300, 200);
  pg.pixelDensity(1);
  pg.background(0);
  const col = [[214, 196, 140], [226, 208, 152], [200, 188, 150]][variant % 3];
  const body = chaikin([[38, 172], [120, 175], [214, 172], [236, 140], [244, 110], [226, 99], [196, 104],
    [160, 100], [118, 98], [86, 112], [66, 138], [50, 160]], 2, true);
  braid(pg, densify(body, 2), col);
  const sp = [];
  const turns = 3.25 + (variant % 2) * 0.5;
  for (let a = 0; a <= turns * Math.PI * 2; a += 0.12) {
    const r = 37 * a / (turns * Math.PI * 2);
    const ang = a + Math.PI / 2 - turns * Math.PI * 2;
    sp.push([150 + r * Math.cos(ang), 62 + r * Math.sin(ang)]);
  }
  braid(pg, densify(sp, 2), col);
  braid(pg, densify([[236, 104], [250, 90], [260, 78]], 2), col);
  braid(pg, densify([[242, 110], [264, 100], [282, 92]], 2), col);
  for (const e of [[260, 76], [283, 91]]) {
    pg.noFill();
    pg.stroke(col[0], col[1], col[2], 220);
    pg.strokeWeight(1.3);
    pg.circle(e[0], e[1], 13);
    pg.noStroke();
    pg.fill(236, 70, 44);
    pg.circle(e[0], e[1], 6.5);
  }
  return pg;
}

/* ============================================================
   주파수 → 둘레길 위치
   ============================================================ */
function hzToUnit(hz) {
  const M = CFG.FREQ_MAP;
  hz = clampN(hz, M[0][0], M[M.length - 1][0]);
  for (let i = 1; i < M.length; i++) {
    if (hz <= M[i][0]) {
      const a = M[i - 1];
      const b = M[i];
      // 가장 낮은 구간(20–12000Hz)은 귀가 듣는 방식대로 로그 눈금
      const t = i === 1 ? Math.log(hz / a[0]) / Math.log(b[0] / a[0]) : (hz - a[0]) / (b[0] - a[0]);
      return mixN(a[1], b[1], t);
    }
  }
  return 1;
}

function hzToTrail(hz) {
  return clampN(hzToUnit(hz) * T.TURNS, W_MIN, T.TURNS);
}

/* ============================================================
   달팽이 받기 — 다른 서버에서 넘어오는 입구
   msg = { id, hz, image }   image: 달팽이 그림의 URL 또는 dataURL (투명 PNG 권장)
   ============================================================ */
function receiveSnail(msg) {
  msg = msg || {};
  const hzRaw = msg.hz ?? msg.freq ?? msg.frequency ?? msg.value;
  const hz = Number.isFinite(Number(hzRaw)) ? Number(hzRaw) : 15000;
  const src = msg.image || msg.img || msg.snail;
  const fallback = () => launchSnail(hz, random(placeholderStickers), msg.id);
  if (typeof src === 'string' && src.length) {
    loadImage(src, im => launchSnail(hz, makeSticker(im), msg.id), fallback);
  } else if (src && src.width) {
    launchSnail(hz, makeSticker(src), msg.id);
  } else {
    fallback();
  }
}

function newSnail(hz, st, id) {
  const home = hzToTrail(hz);
  return {
    id: id == null ? 'snail-' + (++snailSeq) : id,
    hz, st, home,
    w: home, target: home, dir: 1,
    speed: random(5, 11),
    pause: 0,
    ph: random(Math.PI * 2),
    sz: random(0.9, 1.12),
  };
}

function launchSnail(hz, st, id) {
  const sn = newSnail(hz, st, id);
  flyIn(sn);
  return sn;                 // 포트: app.js가 달팽이에 ear·크기를 붙일 수 있게 돌려줌
}

function flyIn(sn) {
  const tp = railPoint(sn.w);
  const lp = lipPoint(sn.w, 0);
  const a = axisAt(clampN(sn.w / T.TURNS, 0, 1));
  // 카메라 기준 왼쪽 뒤에서 시작 → 뒤를 돌아 오른쪽 → 앞으로
  const phi0 = Math.PI / 2 - camA + radians(138);
  let phi1 = lp[3];
  while (phi1 < phi0 + radians(170)) phi1 += Math.PI * 2;
  // 화면 왼쪽 바깥에서 들어오도록 출발 거리를 화면 비율에 맞춘다
  const den = 0.669 - 1.1 * cam.hw * 0.743;
  const rho0 = den > 0.12 ? clampN(1.1 * cam.hw * cam.D / den, 760, 3000) : 3000;
  arrivals.push({
    sn, t: 0, stage: 'fly', hop: 0,
    phi0, phi1, cx: a[0], cz: a[1],
    rho0, rho1: lp[4] + 22,
    y0: tp[1] + 230, y1: tp[1] + 9,
    sc: random(0.92, 1.2),
    col: jitterColor(CFG.COL.plane),
    seed: random(100),
  });
}

function jitterColor(c) {
  const d = random(-16, 14);
  return [clampN(c[0] + d + random(-6, 6), 0, 255), clampN(c[1] + d, 0, 255), clampN(c[2] + d + random(-10, 10), 0, 255)];
}

function sendTestSnail(hz) {
  if (hz == null) {
    const r = random();
    hz = r < 0.7 ? random(12000, 19000) : r < 0.9 ? random(2000, 12000) : random(19000, 20000);
  }
  receiveSnail({ hz });
}

function connectServer() {
  if (!CFG.SERVER_URL) return;
  try {
    ws = new WebSocket(CFG.SERVER_URL);
    ws.onmessage = e => { try { receiveSnail(JSON.parse(e.data)); } catch (err) { /* 형식이 다른 메시지는 건너뜀 */ } };
    ws.onclose = () => setTimeout(connectServer, 3000);
  } catch (err) {
    setTimeout(connectServer, 5000);
  }
}

/* ============================================================
   종이비행기
   ============================================================ */
// 모델 좌표: x 앞, y 위, z 오른쪽
const PLANE_V = { N: [20, 0, 0], K: [-15, -7, 0], FL: [-15, 0, 2], FR: [-15, 0, -2], WL: [-15, 2.5, 12], WR: [-15, 2.5, -12] };
const PLANE_TRIS = [['N', 'FL', 'WL', 1], ['N', 'WR', 'FR', 1], ['N', 'K', 'FL', 0.8], ['N', 'FR', 'K', 0.8]];

function eulerF(yaw, pitch) {
  return [Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)];
}

function planeBasis(F, roll) {
  let R = cross3(F, [0, 1, 0]);
  R = len3(R) < 1e-5 ? [1, 0, 0] : norm3(R);
  const U = cross3(R, F);
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  return [F, add3(mul3(U, c), mul3(R, -s)), add3(mul3(R, c), mul3(U, s))];
}

function planeTris(pos, basis, sc) {
  const P = {};
  for (const k in PLANE_V) {
    const m = PLANE_V[k];
    P[k] = add3(pos, add3(add3(mul3(basis[0], m[0] * sc), mul3(basis[1], m[1] * sc)), mul3(basis[2], m[2] * sc)));
  }
  return PLANE_TRIS.map(t => ({ p: [P[t[0]], P[t[1]], P[t[2]]], mul: t[3] }));
}

function arrivalPos(A, t) {
  const e = t * t * (3 - 2 * t);
  const k = Math.pow(1 - e, 1.6);
  const phi = mixN(A.phi0, A.phi1, e);
  const rho = A.rho1 + (A.rho0 - A.rho1) * k;
  const y = A.y1 + (A.y0 - A.y1) * k + Math.sin(t * 9 + A.seed) * 5 * (1 - e);
  return [A.cx + rho * Math.cos(phi), y, A.cz + rho * Math.sin(phi)];
}

function arrivalPose(A) {
  const t = clampN(A.t, 0, 1);
  const tt = Math.min(t, 0.985);
  const pos = arrivalPos(A, t);
  const F = norm3(sub3(arrivalPos(A, tt + 0.012), arrivalPos(A, tt)));
  const e = t * t * (3 - 2 * t);
  const bob = A.stage === 'fly' ? 0 : Math.sin(millis() / 1000 * 3 + A.seed) * 1.2;
  pos[1] += bob;
  return { pos, basis: planeBasis(F, 0.4 * (1 - e)) };
}

// 떨어진 비행기를 바닥에 놓는다. 자세·높이를 매번 다르게 해서 규칙적으로 쌓이지 않게.
function landPlane(x, z, yaw, sc, col) {
  let n = 0;
  for (const q of pile) if (Math.hypot(q.x - x, q.z - z) < 26) n++;
  const r = random();
  let pitch = 0;
  let roll = 0;
  if (r < 0.42) { roll = random(0.3, 0.75) * (random() < 0.5 ? -1 : 1); pitch = random(-0.1, 0.12); }   // 비스듬히 누움
  else if (r < 0.62) { roll = Math.PI + random(-0.25, 0.25); pitch = random(-0.1, 0.1); }                 // 뒤집힘
  else if (r < 0.82) { pitch = -random(0.45, 1.0); roll = random(-0.5, 0.5); }                            // 코를 박음
  else { roll = random(1.15, 1.5) * (random() < 0.5 ? -1 : 1); pitch = random(-0.2, 0.2); }               // 옆으로 섬
  const basis = planeBasis(eulerF(yaw, pitch), roll);
  let tris = planeTris([x, 0, z], basis, sc);
  let minY = Infinity;
  for (const t of tris) {
    for (const p of t.p) { if (p[1] < minY) { minY = p[1]; } }
  }
  const lift = -minY + 0.4 + Math.min(n, 9) * 2.3 * sc;
  tris = planeTris([x, lift, z], basis, sc);
  pile.push({ x, z, sc, col, tris });
  if (pile.length > CFG.MAX_PLANES) pile.shift();
}

function dropPlane(A, pose) {
  const F = pose.basis[0];
  falling.push({
    x: pose.pos[0], y: pose.pos[1], z: pose.pos[2],
    vy: 10,
    yaw: Math.atan2(F[2], F[0]), pitch: Math.asin(clampN(F[1], -1, 1)), roll: 0,
    sy: random(-1.6, 1.6), sp: random(-2.2, -0.6), sr: random(-3, 3),
    landR: T.RB * 1.08 + random(16, 120),   // 타워 밑동 바깥, 매번 다른 거리
    sc: A.sc, col: A.col, ph: random(Math.PI * 2),
  });
}

function updateFalling(dt, now) {
  const ax = axisAt(0);
  for (let i = falling.length - 1; i >= 0; i--) {
    const f = falling[i];
    f.vy = Math.max(f.vy - 420 * dt, -210);
    f.y += f.vy * dt;
    f.yaw += f.sy * dt;
    f.pitch = clampN(f.pitch + f.sp * dt, -1.3, 0.5);
    f.roll += (f.sr + Math.sin(now * 5 + f.ph) * 2.5) * dt;
    let rx = f.x - ax[0];
    let rz = f.z - ax[1];
    const r = Math.hypot(rx, rz) || 1;
    if (r < f.landR) {
      f.x += (rx / r) * 60 * dt;
      f.z += (rz / r) * 60 * dt;
    }
    f.x += Math.sin(now * 3.1 + f.ph) * 14 * dt;
    if (f.y <= 6) {
      landPlane(f.x, f.z, f.yaw, f.sc, f.col);
      falling.splice(i, 1);
    }
  }
}

function updateArrivals(dt) {
  for (let i = arrivals.length - 1; i >= 0; i--) {
    const A = arrivals[i];
    if (A.stage === 'fly') {
      A.t += dt / CFG.FLIGHT_SEC;
      if (A.t >= 1) { A.t = 1; A.stage = 'hop'; }
    } else {
      A.hop += dt / 0.8;
      if (A.hop >= 1) {
        dropPlane(A, arrivalPose(A));
        A.sn.pause = millis() / 1000 + random(0.6, 2);
        snails.push(A.sn);
        if (snails.length > CFG.MAX_SNAILS) snails.shift();
        arrivals.splice(i, 1);
      }
    }
  }
}

function updateSnails(dt, now) {
  for (const sn of snails) {
    if (now < sn.pause) continue;
    const d = sn.target - sn.w;
    if (Math.abs(d) < 0.004) {
      sn.pause = now + random(1.5, 6);
      sn.target = clampN(sn.home + random(-CFG.WANDER, CFG.WANDER) * T.TURNS, W_MIN, W_MAX);
      continue;
    }
    sn.dir = d > 0 ? 1 : -1;
    const r = Math.max(lipPoint(sn.w, 3)[4], 15);
    sn.w += sn.dir * sn.speed * dt / (Math.PI * 2 * r);
    sn.ph += dt * 5;
  }
}

/* ============================================================
   서울의 해와 날씨
   ============================================================ */
// 서울(37.57N, 126.98E)의 태양 고도(도). 간단한 천문 근사식.
function sunElevationSeoul(date) {
  const rad = Math.PI / 180;
  const lat = 37.5665 * rad;
  const lon = 126.978;
  const d = date.getTime() / 86400000 - 10957.5;      // J2000.0 기준 날수
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = 18.697374558 + 24.06570982441908 * d;  // 시간
  const lst = (gmst * 15 + lon) * rad;
  const ha = lst - ra;
  return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha)) / rad;
}

function seoulDateAtHour(h) {
  const KST = 9 * 3600000;
  const dayStart = Math.floor((Date.now() + KST) / 86400000) * 86400000 - KST;
  return new Date(dayStart + h * 3600000);
}

const WEATHER_PRESET = {
  clear: { kind: 'clear', inten: 0, cloud: 0.05, wind: 0.1 },
  cloud: { kind: 'cloud', inten: 0, cloud: 0.92, wind: 0.15 },
  rain: { kind: 'rain', inten: 0.6, cloud: 0.95, wind: 0.3 },
  snow: { kind: 'snow', inten: 0.6, cloud: 0.9, wind: 0.12 },
  fog: { kind: 'fog', inten: 0.7, cloud: 0.8, wind: 0.05 },
  storm: { kind: 'storm', inten: 0.95, cloud: 1, wind: 0.6 },
};
const WEATHER_KO = { clear: '맑음', cloud: '흐림', rain: '비', snow: '눈', fog: '안개', storm: '뇌우' };

function parseWeather(c) {
  const code = Number(c.weather_code);
  let cloud = clampN((Number(c.cloud_cover) || 0) / 100, 0, 1);
  const speed = Number(c.wind_speed_10m) || 0;
  const wdir = Number(c.wind_direction_10m) || 0;
  const wind = clampN(speed / 40, 0, 1) * (-Math.sin(wdir * Math.PI / 180) >= 0 ? 1 : -1);
  let kind = 'clear';
  let inten = 0;
  const light = [51, 56, 61, 66, 71, 77, 80, 85];
  const heavy = [55, 57, 65, 67, 75, 82, 86];
  const lvl = heavy.includes(code) ? 0.9 : light.includes(code) ? 0.3 : 0.6;
  if ([71, 73, 75, 77, 85, 86].includes(code)) { kind = 'snow'; inten = lvl; }
  else if ([95, 96, 99].includes(code)) { kind = 'storm'; inten = 0.95; }
  else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) { kind = 'rain'; inten = lvl; }
  else if (code === 45 || code === 48) { kind = 'fog'; inten = 0.7; }
  else if (code === 3 || cloud > 0.6) { kind = 'cloud'; }
  if (kind !== 'clear' && kind !== 'cloud') cloud = Math.max(cloud, 0.85);
  return { kind, inten, cloud, wind, temp: Number(c.temperature_2m), live: true };
}

function fetchWeather() {
  if (typeof fetch !== 'function') return;
  fetch(CFG.WEATHER_URL)
    .then(r => r.json())
    .then(j => { if (j && j.current) weatherLive = parseWeather(j.current); })
    .catch(() => { /* 불러오지 못하면 맑은 날로 두고 계속 진행 */ });
}

function currentWeather() {
  if (weatherOverride && WEATHER_PRESET[weatherOverride]) return WEATHER_PRESET[weatherOverride];
  return weatherLive || WEATHER_PRESET.clear;
}

function setWeatherOverride(kind) { weatherOverride = kind || null; look = null; }
function setTimeOverride(h) { hourOverride = (h === null || h === undefined) ? null : Number(h); look = null; }

// 해의 고도와 날씨 → 배경지 색, 조명 색
function computeLook() {
  const date = hourOverride == null ? new Date() : seoulDateAtHour(hourOverride);
  const el = sunElevationSeoul(date);
  const wx = currentWeather();
  const dayAmt = sstep(-7, 9, el);
  const gold = Math.exp(-Math.pow((el - 1) / 6, 2)) * (1 - wx.cloud * 0.75);

  let sky = mix3([46, 62, 118],   // 포트: 밤이 너무 어두워 밝기·채도를 올림 (11/10 사용자 요청, 값은 Claude가 정함. 원본 [34, 42, 68])
    [160, 178, 176], dayAmt);
  sky = mix3(sky, [228, 152, 108], gold * 0.6);
  const gr = (sky[0] + sky[1] + sky[2]) / 3;
  sky = mix3(sky, [gr * 0.86, gr * 0.9, gr * 0.95], wx.cloud * (wx.kind === 'snow' ? 0.35 : 0.5));
  if (wx.kind === 'snow') sky = mix3(sky, [205, 212, 220], 0.08 + 0.25 * dayAmt);
  if (wx.kind === 'fog') sky = mix3(sky, [gr + 26, gr + 28, gr + 28], 0.4);

  let amb = mix3([74, 88, 140],   // 포트: 원본 [54, 62, 92]
    [128, 130, 128], dayAmt);
  amb = mix3(amb, [150, 118, 96], gold * 0.45);
  amb = mul3(amb, 1 + wx.cloud * 0.12 * dayAmt);
  let dir = mix3([84, 100, 158],  // 포트: 원본 [34, 40, 62]. 직사광을 더 올려 대비를 키움
    [158, 152, 140], dayAmt);
  dir = mix3(dir, [215, 140, 84], gold * 0.6);
  dir = mul3(dir, 1 - wx.cloud * 0.55);

  const sd = new Date(date.getTime() + 9 * 3600000);
  const hh = String(sd.getUTCHours()).padStart(2, '0');
  const mm = String(sd.getUTCMinutes()).padStart(2, '0');
  return { sky, amb, dir, ly: mixN(0.32, 0.85, dayAmt), bright: mixN(195, 255, dayAmt), el, wx, dayAmt, clock: hh + ':' + mm };
}

function towerStatus() {
  if (!look) return '';
  const wx = look.wx;
  const temp = Number.isFinite(wx.temp) ? ' ' + Math.round(wx.temp) + '°C' : '';
  const src = weatherOverride ? '날씨 수동' : wx.live ? '실시간 날씨' : '날씨 기본값';
  return '서울 ' + look.clock + ' · ' + WEATHER_KO[wx.kind] + temp + ' · 태양 고도 ' + look.el.toFixed(1) + '° · ' +
    '달팽이 ' + (snails.length + arrivals.length) + ' · 종이비행기 ' + pile.length + ' · ' + src;
}

/* ───────────── 날씨 입자 (2D) ───────────── */
function syncParticles(wx) {
  const k = wx.kind + '|' + Math.round(wx.inten * 10) + '|' + width + 'x' + height;
  if (k === particleKey) return;
  particleKey = k;
  particles = [];
  const area = clampN((width * height) / (900 * 700), 0.4, 2.2);
  let n = 0;
  if (wx.kind === 'rain' || wx.kind === 'storm') n = Math.round((90 + 420 * wx.inten) * area);
  else if (wx.kind === 'snow') n = Math.round((70 + 300 * wx.inten) * area);
  for (let i = 0; i < n; i++) {
    particles.push({ x: random(-0.2, 1.2) * width, y: random(height), z: random(), ph: random(Math.PI * 2), sp: random(0.75, 1.25) });
  }
}

function updateParticles(dt, wx, now) {
  const hs = height / 700;
  for (const p of particles) {
    if (wx.kind === 'snow') {
      p.y += mixN(26, 90, p.z) * p.sp * hs * dt;
      p.x += (wx.wind * 40 + Math.sin(now * 0.8 + p.ph) * 14) * dt;
    } else {
      const v = mixN(520, 1150, p.z) * p.sp * hs;
      p.y += v * dt;
      p.x += wx.wind * 0.5 * v * dt;
    }
    if (p.y > height + 30) { p.y = -30; p.x = random(-0.2, 1.2) * width; }
  }
}

function drawParticles(pg, back, wx) {
  if (!particles.length) return;
  const snow = wx.kind === 'snow';
  const dim = look ? mixN(0.6, 1, look.dayAmt) : 1;
  for (const p of particles) {
    if ((p.z < 0.55) !== back) continue;
    if (snow) {
      pg.noStroke();
      pg.fill(250, 250, 246, mixN(110, 235, p.z) * dim);
      pg.circle(p.x, p.y, mixN(1.4, 4.8, p.z));
    } else {
      const l = mixN(9, 30, p.z);
      pg.stroke(215, 228, 240, mixN(40, 125, p.z) * dim);
      pg.strokeWeight(mixN(0.7, 1.5, p.z));
      pg.line(p.x, p.y, p.x + wx.wind * 0.5 * l, p.y + l);
    }
  }
}

function drawFog(pg, back, wx, now) {
  if (wx.kind !== 'fog') return;
  const n = back ? 4 : 3;
  pg.drawingContext.globalAlpha = wx.inten * (back ? 0.75 : 0.5);
  for (let i = 0; i < n; i++) {
    const k = back ? i : i + 4;
    const dirn = k % 2 ? 1 : -1;
    const fx = (((k * 0.37 + now * 0.006 * dirn) % 1.4) + 1.4) % 1.4 - 0.2;
    const fy = 0.3 + 0.1 * k;
    const sz = width * (0.9 + 0.15 * (k % 3));
    pg.image(fogImg, fx * width - sz / 2, fy * height - sz * 0.25, sz, sz * 0.5);
  }
  pg.drawingContext.globalAlpha = 1;
}

/* ============================================================
   카메라와 3D 그리기
   ============================================================ */
function updateCamera() {
  const fov = radians(27);
  const aspect = width / height;
  const th = Math.tan(fov / 2);
  const D = Math.max((T.H * 1.5 / 2) / th, (560 / 2) / (aspect * th));
  const cy = T.H * 0.5;
  cam.eye = [D * Math.sin(camA), cy + D * 0.045, D * Math.cos(camA)];
  cam.ctr = [0, cy, 0];
  cam.fwd = norm3(sub3(cam.ctr, cam.eye));
  cam.right = norm3(cross3(cam.fwd, [0, 1, 0]));
  cam.fov = fov;
  cam.D = D;
  cam.hw = th * aspect;   // 화면 반폭 / 거리
}

function emit(p, u, v) {
  vertex(p[0], -p[1], p[2], u, v);
}

// 평면 스티커 한 장 (항상 카메라를 바라본다)
function drawSticker(it) {
  const st = it.st;
  const w = it.size;
  const h = w * st.aspect;
  const ct = Math.cos(it.tilt);
  const sn = Math.sin(it.tilt);
  const ax = [cam.right[0] * ct, sn, cam.right[2] * ct];
  const ay = [-cam.right[0] * sn, ct, -cam.right[2] * sn];
  const lo = -(1 - st.foot) * h;
  const hi = st.foot * h;
  const bl = add3(it.base, add3(mul3(ax, -w / 2), mul3(ay, lo)));
  const br = add3(it.base, add3(mul3(ax, w / 2), mul3(ay, lo)));
  const tr = add3(it.base, add3(mul3(ax, w / 2), mul3(ay, hi)));
  const tl = add3(it.base, add3(mul3(ax, -w / 2), mul3(ay, hi)));
  const u0 = it.flip ? 1 : 0;
  const u1 = it.flip ? 0 : 1;
  texture(st.img);
  beginShape(TRIANGLES);
  emit(bl, u0, 1); emit(br, u1, 1); emit(tr, u1, 0);
  emit(bl, u0, 1); emit(tr, u1, 0); emit(tl, u0, 0);
  endShape();
}

// 화면을 꼭 채우는 판을 카메라 앞 dist 거리에 세운다 (2D 레이어를 3D 장면의 앞뒤에 끼우는 용도)
function screenQuad(pg, dist) {
  const up = cross3(cam.right, cam.fwd);
  const hh = dist * Math.tan(cam.fov / 2);
  const hw = hh * (width / height);
  const c = add3(cam.eye, mul3(cam.fwd, dist));
  const tl = add3(c, add3(mul3(cam.right, -hw), mul3(up, hh)));
  const tr = add3(c, add3(mul3(cam.right, hw), mul3(up, hh)));
  const br = add3(c, add3(mul3(cam.right, hw), mul3(up, -hh)));
  const bl = add3(c, add3(mul3(cam.right, -hw), mul3(up, -hh)));
  texture(pg);
  beginShape(TRIANGLES);
  emit(tl, 0, 0); emit(tr, 1, 0); emit(br, 1, 1);
  emit(tl, 0, 0); emit(br, 1, 1); emit(bl, 0, 1);
  endShape();
}

function render3D(now) {
  background(0);
  perspective(cam.fov, width / height, 30, 12000);
  camera(cam.eye[0], -cam.eye[1], cam.eye[2], cam.ctr[0], -cam.ctr[1], cam.ctr[2], 0, 1, 0);
  noStroke();
  textureMode(NORMAL);
  noLights();
  screenQuad(bgL, cam.D + 3200);          // 배경지 + 뒤쪽 날씨

  // 조명은 카메라 왼쪽 위에서 — 턴테이블 위의 모형을 고정된 스튜디오 조명으로 찍는 느낌
  const flat = norm3([cam.fwd[0], 0, cam.fwd[2]]);
  const L = norm3(add3(add3(mul3(cam.right, 0.55), [0, -look.ly, 0]), mul3(flat, 0.5)));
  const A = look.amb;
  const D = look.dir;
  ambientLight(A[0], A[1], A[2]);
  directionalLight(D[0], D[1], D[2], L[0], -L[1], L[2]);

  texture(tableTex);
  model(tableGeom);
  texture(towerTex);
  model(towerGeom);
  texture(domeTex);
  model(domeGeom);
  const fc = CFG.COL.fence;
  fill(fc[0], fc[1], fc[2]);
  model(fenceGeom);

  noLights();

  // 바닥 비행기의 접지 그림자
  if (pile.length) {
    texture(blobImg);
    beginShape(TRIANGLES);
    for (const q of pile) {
      const r = 26 * q.sc;
      const y = 0.6;
      emit([q.x - r, y, q.z - r], 0, 0); emit([q.x + r, y, q.z - r], 1, 0); emit([q.x + r, y, q.z + r], 1, 1);
      emit([q.x - r, y, q.z - r], 0, 0); emit([q.x + r, y, q.z + r], 1, 1); emit([q.x - r, y, q.z + r], 0, 1);
    }
    endShape();
  }

  // 종이비행기 (면마다 직접 음영을 계산 — 종이는 양면이 다 보이므로)
  const sets = [];
  for (const q of pile) sets.push([q.tris, q.col]);
  for (const f of falling) sets.push([planeTris([f.x, f.y, f.z], planeBasis(eulerF(f.yaw, f.pitch), f.roll), f.sc), f.col]);
  const poses = [];
  for (const a of arrivals) {
    const pose = arrivalPose(a);
    poses.push(pose);
    sets.push([planeTris(pose.pos, pose.basis, a.sc), a.col]);
  }
  if (sets.length) {
    beginShape(TRIANGLES);
    for (const set of sets) {
      const col = set[1];
      for (const t of set[0]) {
        const n = norm3(cross3(sub3(t.p[1], t.p[0]), sub3(t.p[2], t.p[0])));
        const lam = Math.abs(dot3(n, L));
        const r = clampN(col[0] * t.mul * (A[0] + D[0] * lam) / 235, 0, 255);
        const gg = clampN(col[1] * t.mul * (A[1] + D[1] * lam) / 235, 0, 255);
        const b = clampN(col[2] * t.mul * (A[2] + D[2] * lam) / 235, 0, 255);
        fill(r, gg, b);
        for (const p of t.p) vertex(p[0], -p[1], p[2]);
      }
    }
    endShape();
  }

  // 달팽이 스티커 — 먼 것부터
  const items = [];
  for (const sn of snails) {
    const base = railPoint(sn.w);
    const ahead = railPoint(sn.w + 0.004 * sn.dir);
    const goingRight = dot3(sub3(ahead, base), cam.right) >= 0;
    const moving = now >= sn.pause;
    items.push({
      st: sn.st, base,
      size: CFG.SNAIL_SIZE * sn.sz * (moving ? 1 + 0.05 * Math.sin(sn.ph) : 1),
      flip: goingRight !== CFG.SNAIL_FACES_RIGHT,
      tilt: moving ? 0.05 * Math.sin(sn.ph * 0.5) : 0,
    });
  }
  for (let i = 0; i < arrivals.length; i++) {
    const a = arrivals[i];
    const pose = poses[i];
    const seat = add3(pose.pos, mul3(pose.basis[1], -5.5 * a.sc));
    let base = seat;
    let size = CFG.SNAIL_SIZE * a.sn.sz * 0.74;
    if (a.stage === 'hop') {
      const h = clampN(a.hop, 0, 1);
      const e = h * h * (3 - 2 * h);
      base = mix3(seat, railPoint(a.sn.w), e);
      base[1] += Math.sin(h * Math.PI) * 16;
      size = CFG.SNAIL_SIZE * a.sn.sz * mixN(0.74, 1, e);
    }
    const goingRight = dot3(pose.basis[0], cam.right) >= 0;
    items.push({ st: a.sn.st, base, size, flip: goingRight !== CFG.SNAIL_FACES_RIGHT, tilt: 0.12 * Math.sin(now * 2 + a.seed) });
  }
  for (const it of items) it.depth = dot3(sub3(it.base, cam.eye), cam.fwd);
  items.sort((p, q) => q.depth - p.depth);
  tint(look.bright);
  for (const it of items) drawSticker(it);
  tint(255);                              // 포트: p5 1.9.4 WEBGL에서 noTint()는 다음 그리기에서 오류가 나서 흰 틴트로 되돌림
  screenQuad(fxL, 40);                    // 앞쪽 날씨 + 그레인 + 비네팅
}

/* ============================================================
   p5 진입점
   ============================================================ */
function stageSize() {
  const host = document.getElementById('stage');
  let w = host ? host.clientWidth : windowWidth;
  let h = host ? host.clientHeight : windowHeight;
  if (!w || w < 50) w = 600;
  if (!h || h < 50) h = Math.round(w * 1.25);
  return { host, w, h };
}

function makeLayers(w, h) {
  if (bgL) bgL.remove();
  if (fxL) fxL.remove();
  bgL = createGraphics(w, h);
  fxL = createGraphics(w, h);
}

function setup() {
  const sz = stageSize();
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  const c = createCanvas(sz.w, sz.h, WEBGL);
  if (sz.host) c.parent(sz.host);
  makeLayers(sz.w, sz.h);
  noiseSeed(7);
  randomSeed(7);

  towerTex = buildTowerTexture();
  domeTex = buildDomeTexture();
  tableTex = buildTableTexture();
  paperImg = buildPaper();
  grainImg = buildGrain();
  vignetteImg = radialImage(256, [[0, 'rgba(8,10,14,0)'], [0.55, 'rgba(8,10,14,0)'], [1, 'rgba(8,10,14,0.5)']]);
  blobImg = radialImage(64, [[0, 'rgba(20,16,10,0.42)'], [0.5, 'rgba(20,16,10,0.2)'], [1, 'rgba(20,16,10,0)']]);
  fogImg = radialImage(256, [[0, 'rgba(236,240,240,0.55)'], [0.6, 'rgba(236,240,240,0.2)'], [1, 'rgba(236,240,240,0)']]);

  towerGeom = buildTower();
  domeGeom = buildDome();
  fenceGeom = buildFence();
  tableGeom = buildTable();

  for (let i = 0; i < 3; i++) {
    const pg = placeholderSnail(i);
    placeholderStickers.push(makeSticker(pg));
    pg.remove();
  }

  // 타고 온 비행기 몇 대는 처음부터 떨어져 있다. 포트: 임시 달팽이는 ?demo=1 일 때만 올려 둔다
  randomSeed(Date.now() % 100000);
  if (CFG.DEMO) {
    for (const hz of [9000, 14500, 17800]) {
      const sn = newSnail(hz, random(placeholderStickers));
      sn.pause = random(0, 3);
      snails.push(sn);
    }
  }
  const ax = axisAt(0);
  for (let i = 0; i < 5; i++) {
    const a = random(Math.PI * 2);
    const r = T.RB + random(24, 150);
    landPlane(ax[0] + Math.cos(a) * r, ax[1] + Math.sin(a) * r, random(Math.PI * 2), random(0.92, 1.2), jitterColor(CFG.COL.plane));
  }

  updateCamera();
  look = computeLook();
  fetchWeather();
  setInterval(fetchWeather, CFG.WEATHER_REFRESH_MIN * 60000);
  connectServer();
  if (window.towerReady) window.towerReady();   // 포트: app.js가 피드를 시작
}

function draw() {
  const dt = Math.min(deltaTime, 60) / 1000;
  const now = millis() / 1000;

  if (orbitOn && !(mouseIsPressed && pressOnCanvas)) camA += CFG.ORBIT * dt;
  updateCamera();
  if (!look || frameCount % 20 === 0) look = computeLook();
  const wx = look.wx;

  if (CFG.DEMO && !CFG.SERVER_URL && demoSent < CFG.DEMO_MAX && now - lastDemo > CFG.DEMO_INTERVAL) {
    lastDemo = now;
    demoSent++;
    sendTestSnail();
  }

  updateArrivals(dt);
  updateFalling(dt, now);
  updateSnails(dt, now);
  syncParticles(wx);
  updateParticles(dt, wx, now);

  // 뒤 레이어: 하늘색 위에 구겨진 종이를 곱하고, 먼 쪽 날씨를 그린다
  bgL.blendMode(BLEND);
  bgL.background(look.sky[0], look.sky[1], look.sky[2]);
  bgL.blendMode(MULTIPLY);
  const k = Math.max(width / paperImg.width, height / paperImg.height);
  bgL.image(paperImg, (width - paperImg.width * k) / 2, (height - paperImg.height * k) / 2, paperImg.width * k, paperImg.height * k);
  bgL.blendMode(BLEND);
  drawFog(bgL, true, wx, now);
  drawParticles(bgL, true, wx);

  // 앞 레이어: 가까운 쪽 날씨, 번개, 필름 그레인, 비네팅
  fxL.clear();
  drawParticles(fxL, false, wx);
  drawFog(fxL, false, wx, now);
  if (wx.kind === 'storm') {
    if (now > nextFlash) { flash = 1; nextFlash = now + random(5, 14); }
    if (flash > 0.01) {
      fxL.noStroke();
      fxL.fill(235, 240, 255, flash * 150);
      fxL.rect(0, 0, width, height);
      flash *= 0.82;
    }
  }
  if (frameCount % CFG.GRAIN_HOLD === 0) { grainOX = -Math.floor(Math.random() * 256); grainOY = -Math.floor(Math.random() * 256); }
  for (let y = grainOY; y < height; y += 256) {
    for (let x = grainOX; x < width; x += 256) { fxL.image(grainImg, x, y); }
  }
  fxL.image(vignetteImg, 0, 0, width, height);
  if (window.towerOverlay) window.towerOverlay(fxL, now);   // 포트: 카드·마리 수 (app.js)
  if (hud) {
    fxL.noStroke();
    fxL.fill(255, 225);
    fxL.textSize(12);
    fxL.textAlign(LEFT, BOTTOM);
    fxL.text(towerStatus(), 12, height - 10);
  }

  render3D(now);
}

function windowResized() {
  const sz = stageSize();
  resizeCanvas(sz.w, sz.h);
  makeLayers(sz.w, sz.h);
  particleKey = '';
}

function mousePressed(e) {
  if (e && e.target && e.target.tagName !== 'CANVAS') { pressOnCanvas = false; return; }   // 포트: 디버그 창을 누를 때는 타워를 돌리지 않음
  pressOnCanvas = mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
  dragMoved = 0;
}

function mouseDragged() {
  if (!pressOnCanvas) return;
  camA -= (mouseX - pmouseX) * 0.006;
  dragMoved += Math.abs(mouseX - pmouseX);
}

function mouseReleased() {
  if (CFG.DEMO && pressOnCanvas && dragMoved < 6) sendTestSnail();
  pressOnCanvas = false;
}

function keyPressed() {
  const presets = { '1': 'clear', '2': 'cloud', '3': 'rain', '4': 'snow', '5': 'fog', '6': 'storm' };
  if (window.towerKey) window.towerKey(key);   // 포트: F 전체화면, R 리셋, D 디버그 (app.js)
  if (key === ' ') { if (CFG.DEMO) sendTestSnail(); return false; }
  if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  if (presets[key]) setWeatherOverride(presets[key]);
  else if (key === '0') setWeatherOverride(null);
  else if (key === 't' || key === 'T') {
    const cyc = [null, 7.1, 12.5, 17.3, 22];
    setTimeOverride(cyc[(cyc.indexOf(hourOverride) + 1) % cyc.length]);
  } else if (key === 'o' || key === 'O') orbitOn = !orbitOn;
  else if (key === 'h' || key === 'H') hud = !hud;
}
