/**
 * 청감 타워 — 달팽이 스티커
 *
 * 달팽이 모양은 예전 index.html의 Snail 클래스(SVart visuals.js 포트)를 그대로 옮긴 것입니다.
 * 모양 코드는 고치지 않고, 검은 바탕 위에 한 장의 그림으로 그립니다 (makeSnailImage).
 * 11/12부터 흰 종이 스티커 대신 선만 빛나게 합성합니다 (사용자 선택, ref/sketch (14).js 방식).
 * 멈춘 그림이라 점액(움직이는 파티클)은 그리지 않습니다.
 */

// 그림 바탕 (검정). 합성할 때 사라진다
const BG = [4, 5, 10];
const HELIX = { bodyTwists: [3, 22], shellTwists: [4, 30], sep: 0.075, rungEvery: 3, spinSpeed: 1.4 };
const RED_DOT = [255, 59, 31];

// ============================================================
// SVart 오실로스코프 스타일 렌더 헬퍼 (SVart visuals.js 충실 포트)
// ============================================================

const OUTLINE_POINTS = 160;
const WAVE_GAIN = 0.8;
const TAIL_ANGLE = Math.PI - 0.55;  // 왼쪽 바닥 (꼬리)
const HEAD_ANGLE = -0.5;            // 오른쪽 위 (머리)
const SHELL_SPOT = { LOW: -0.75, MID: 0, HIGH: 0.7 };

function _tRgba(c, a) { return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`; }
function _tLerp(a, b, t) { return a + (b - a) * t; }
function _tSq(x) { return x * x; }
function _tAngDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
function _shellEdge(th, k) {
  return _tLerp(1, 0.86 / Math.max(Math.abs(Math.cos(th)), Math.abs(Math.sin(th))), k);
}

// 타워용 파형 시뮬레이션 (실제 오디오 없음)
function _tWaveAt(u, timeMs, seed) {
  const t = timeMs / 1000;
  const s = seed || 0;
  return 0.015 * Math.sin(u * 60 + t * 3.3)
    + 0.18 * Math.sin(u * 23.7 + t * 2.1 + s)
    + 0.11 * Math.sin(u * 7.3 - t * 3.3 + s * 0.7)
    + 0.07 * Math.sin(u * 51.1 + t * 1.7 + s * 1.3);
}

// SVart scopeStroke 충실 포트: 넓은 잔광 → 가는 선 (2패스)
function tScopeStroke(ctx, pts, closed, weight, ink, glow, kick) {
  if (pts.length < 2) return;
  const draw = () => {
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    if (closed) ctx.closePath();
    ctx.stroke();
  };
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.shadowColor = _tRgba(glow, 0.8);
  ctx.shadowBlur = 12 * weight;
  ctx.strokeStyle = _tRgba(glow, 0.38 + 0.22 * kick);
  ctx.lineWidth = (8 + 7 * kick) * weight;
  draw();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = _tRgba(ink, 1);
  ctx.lineWidth = (2.1 + 1.2 * kick) * weight;
  draw();
  ctx.restore();
}

// SVart helixStroke 충실 포트: 호길이 파라미터화 이중나선
function tHelixStroke(ctx, pts, closed, twists, sep, weight, ink, glow, kick, helixAmt, timeMs) {
  if (helixAmt < 0.01) return tScopeStroke(ctx, pts, closed, weight, ink, glow, kick);
  const n = pts.length;
  const s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = s[n - 1] || 1;
  const ph0 = timeMs / 1000 * HELIX.spinSpeed;
  const A = [], B = [], rungs = [];
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1;
    const nx = ty / tl, ny = -tx / tl;
    const u = s[i] / total;
    const env = closed ? Math.pow(Math.sin(Math.PI * u), 0.35) : Math.min(1, u * 6);
    const th = Math.PI * 2 * twists * u + ph0;
    const o = sep * helixAmt * env * Math.sin(th);
    A.push({ x: pts[i].x + nx * o, y: pts[i].y + ny * o });
    B.push({ x: pts[i].x - nx * o, y: pts[i].y - ny * o });
    if (i % HELIX.rungEvery === 0) rungs.push(i);
  }
  tScopeStroke(ctx, A, false, weight, ink, glow, kick);
  tScopeStroke(ctx, B, false, weight * 0.75, ink, glow, kick);
  ctx.save();
  ctx.strokeStyle = _tRgba(ink, 0.55 * helixAmt);
  ctx.lineWidth = 1;
  ctx.beginPath();
  rungs.forEach(i => { ctx.moveTo(A[i].x, A[i].y); ctx.lineTo(B[i].x, B[i].y); });
  ctx.stroke();
  ctx.restore();
}

function tTwistCount(range, twistU) {
  return _tLerp(range[0], range[1], twistU);
}

class SnailShape {
  constructor(pf, seed) {
    this.pf = pf;
    this.ink = pf.inkRGB || [245, 245, 243];
    const inkSum = this.ink[0] + this.ink[1] + this.ink[2];
    this.glow = inkSum > 650 ? RED_DOT : this.ink;
    this.twistU = pf.twistU ?? 0.5;
    this.shellSquare = pf.shellSquare ?? 0;
    this.seed = seed;
    this._antL = pf.dominantEar === 'LEFT' ? 1.4 : 0.9;
    this._antR = pf.dominantEar === 'RIGHT' ? 1.4 : 0.9;
    this._kick = 0;
    this._shellRot = seed;
    this._prevShellX = null;
    this.vel = { x: 1, y: 0 };   // 스티커는 늘 오른쪽을 봄 (CFG.SNAIL_FACES_RIGHT)
    this.R = STICKER_ART.R;
    this.head = { x: STICKER_ART.x, y: STICKER_ART.ground };
  }

  // SVart bodyShape() 충실 포트: 타원에 꼬리·머리 가우스 혹 + 파형 흔들림
  _bodyShape(p) {
    const time = p.millis() / 1000;
    const R0 = this.R;
    const lowDb = this.pf.lowDb || 0, highDb = this.pf.highDb || 0;
    const tailF = 1, tailG = lowDb / 10;
    const headF = 1, headG = highDb / 10;
    const F = (tailF + headF) / 2;
    // face: 이동 방향 (타워는 오른쪽 고정 아님)
    const face = this.vel.x >= 0 ? 1 : -1;

    const crawl = 1.4 * 0.7 * Math.sin(time * 6);
    const hs = (1 + 0.16 * F) * (1 + 0.06 * this._kick) * (1 + 0.05 * crawl);
    const vs = (1 - 0.22 * F) * (1 - 0.1  * this._kick) * (1 - 0.04 * crawl);
    const flatY = R0 * 0.72 * vs;
    const cx = this.head.x;
    const cy = this.head.y - flatY;

    const tailSigma = 0.32 + 0.2 * tailG;
    const tailLen   = tailF * R0 * (1.0 + 0.45 * tailG);
    const headSigma = 0.4  + 0.14 * headG;
    const headLen   = headF * R0 * (0.75 + 0.35 * headG);

    const pointAt = (th) => {
      const wob = 0.3 * (0.045 * Math.sin(3 * th + 1.1 * time) + 0.03 * Math.sin(5 * th - 1.7 * time + 1) + 0.02 * Math.sin(2 * th + 0.6 * time));
      const rr = R0 * (1 + wob);
      let x = rr * Math.cos(th) * hs;
      let y = rr * Math.sin(th) * vs;
      const wt = Math.exp(-_tSq(_tAngDiff(th, TAIL_ANGLE) / tailSigma));
      x -= tailLen * wt;
      y += 0.25 * tailLen * wt;
      const wh = Math.exp(-_tSq(_tSq(_tAngDiff(th, HEAD_ANGLE) / headSigma)));
      x += headLen * wh * 0.9;
      y -= headLen * wh * 0.45;
      if (y > flatY) y = flatY + (y - flatY) * 0.2;
      return { x: cx + face * x, y: cy + y };
    };

    const pts = [];
    for (let i = 0; i < OUTLINE_POINTS; i++) pts.push(pointAt((i / OUTLINE_POINTS) * Math.PI * 2));
    return { pts, cx, cy, R0, face, headTip: pointAt(HEAD_ANGLE), flatY };
  }

  // SVart drawBody() 포트: 파형 흔들린 외곽선 + 내부 채우기 + helixStroke
  _drawBody(ctx, shape, p) {
    const timeMs = p.millis();
    const n = shape.pts.length;
    const amp = shape.R0 * WAVE_GAIN;
    const traced = shape.pts.map((pt, i) => {
      const a = shape.pts[(i - 1 + n) % n], b = shape.pts[(i + 1) % n];
      const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1;
      const w = _tWaveAt(i / n, timeMs, this.seed) * amp;
      return { x: pt.x + (ty / tl) * w, y: pt.y - (tx / tl) * w };
    });
    // 내부 채우기 (뒤 선 가림)
    ctx.save();
    ctx.fillStyle = `rgba(${BG[0]},${BG[1]},${BG[2]},0.88)`;
    ctx.beginPath();
    shape.pts.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    tHelixStroke(ctx, traced, true, tTwistCount(HELIX.bodyTwists, this.twistU), shape.R0 * HELIX.sep, 1, this.ink, this.glow, this._kick, this.twistU, timeMs);
  }

  // SVart drawAntennae() 포트: 머리 위에서 두 줄기, 끝에 검정 원 + 빨간 점
  _drawAntennae(ctx, shape, p) {
    const R0 = shape.R0;
    const tip = shape.headTip;
    const time = p.millis() / 1000;
    const len = R0 * (0.6 + 0.25 * Math.abs(this.pf.highDb || 0) / 10);
    const flick = this._kick * 0.12;
    const face = shape.face;
    const back  = face >= 0 ? 'L' : 'R';
    const front = face >= 0 ? 'R' : 'L';
    const antScale = { L: this._antL, R: this._antR };
    const stalks = [
      { bx: -R0 * 0.24, by: R0 * 0.12, a: -1.25 - flick + Math.sin(time * 1.3) * 0.08, side: back  },
      { bx: -R0 * 0.04, by: R0 * 0.14, a: -0.72 - flick + Math.sin(time * 1.3 + 1.2) * 0.08, side: front }
    ].map(st => ({ ...st, k: antScale[st.side] }));

    stalks.forEach(s => {
      const pts = [];
      for (let k = 0; k <= 20; k++) {
        const q = k / 20;
        const bend = Math.sin(q * Math.PI) * 0.18;
        const dx = Math.cos(s.a - bend) * len * s.k * q;
        const dy = Math.sin(s.a - bend) * len * s.k * q;
        pts.push({ x: tip.x + face * (s.bx + dx), y: tip.y + s.by + dy });
      }
      tScopeStroke(ctx, pts, false, 0.9, this.ink, this.glow, this._kick);
      const e = pts[pts.length - 1];
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = _tRgba(this.ink, 1);
      ctx.lineWidth = 1.5;
      ctx.fillStyle = `rgba(${BG[0]},${BG[1]},${BG[2]},1)`;
      ctx.beginPath(); ctx.arc(e.x, e.y, R0 * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgb(${RED_DOT[0]},${RED_DOT[1]},${RED_DOT[2]})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, R0 * 0.035, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  // SVart drawShell() 포트: 굴러간 거리만큼 회전하는 나선 + shellEdge(네모/동그라미)
  _drawShell(ctx, shape, p) {
    const timeMs = p.millis();
    const R0 = shape.R0;
    const rs = R0 * 0.72;
    const reg = this.pf._raw?.register || 'MID';
    const shellXOffset = (SHELL_SPOT[reg] || 0) * R0;
    const sx = shape.cx + shellXOffset;
    if (this._prevShellX !== null) this._shellRot += (sx - this._prevShellX) / Math.max(rs, 1);
    this._prevShellX = sx;
    const topY = this._topYAt(shape, sx);
    const sy = topY - rs * 0.9 - this._kick * R0 * 0.1;

    ctx.save();
    ctx.fillStyle = `rgba(${BG[0]},${BG[1]},${BG[2]},1)`;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const r = rs * 1.02 * _shellEdge(a, this.shellSquare);
      ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();

    const turns = 3 * Math.PI * 2;
    const spiral = [];
    for (let a = 0; a <= turns; a += 0.07) {
      const u = a / turns;
      const rot = this._shellRot;
      const rr = (rs * (0.06 + 0.9 * u) + _tWaveAt(u, timeMs, this.seed) * rs * 0.35 * u) * _shellEdge(a + rot, this.shellSquare);
      spiral.push({ x: sx + Math.cos(a + rot) * rr, y: sy + Math.sin(a + rot) * rr });
    }
    tHelixStroke(ctx, spiral, false, tTwistCount(HELIX.shellTwists, this.twistU), rs * HELIX.sep * 0.8, 1, this.ink, this.glow, this._kick, this.twistU, timeMs);
    ctx.restore();
  }

  // 등 위(또는 바닥)의 높이: x 근처 외곽선 중 가장 위
  _topYAt(shape, x) {
    const band = shape.R0 * 0.2;
    let best = this.head.y + shape.R0;
    shape.pts.forEach(pt => { if (Math.abs(pt.x - x) < band && pt.y < best) best = pt.y; });
    return best;
  }
}

// 그림 크기 (Claude가 정함). 꼬리·머리·더듬이가 가장 길 때도 잘리지 않게 잡음
const STICKER_ART = { W: 400, H: 250, R: 46, x: 190, ground: 232 };

// pf(mapping.js) → 검은 바탕의 달팽이 그림(canvas). seed가 같으면 같은 그림.
// tower.js가 'screen'으로 합성해서 검은 바탕은 사라지고 선만 빛난다. 여백을 잘라 내서 그림 아래 끝이 발밑이다.
function makeSnailImage(pf, seed) {
  const cv = document.createElement('canvas');
  cv.width = STICKER_ART.W; cv.height = STICKER_ART.H;
  const c = cv.getContext('2d');
  c.fillStyle = `rgb(${BG[0]},${BG[1]},${BG[2]})`;
  c.fillRect(0, 0, cv.width, cv.height);
  const frozen = { millis: () => (seed % 60) * 1000 };   // 파형이 멈춘 한 순간
  const sn = new SnailShape(pf, seed);
  const shape = sn._bodyShape(frozen);
  sn._drawAntennae(c, shape, frozen);
  sn._drawBody(c, shape, frozen);
  sn._drawShell(c, shape, frozen);

  // 선이 있는 범위만 남김
  const px = c.getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width, x1 = 0, y0 = cv.height, y1 = 0;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      const i = 4 * (y * cv.width + x);
      if (px[i] + px[i + 1] + px[i + 2] > 110) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return cv;
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(cv.width - 1, x1 + pad); y1 = Math.min(cv.height - 1, y1 + 2);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
