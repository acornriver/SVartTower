/**
 * SVart dev (3788b31) visuals.js의 정착한 RESULT 달팽이.
 * 타워 피드에는 오디오 파형이 없으므로 SVart의 무음 파형을 사용한다.
 */
const SNAIL_ART = { width: 360, height: 228, x: 163, ground: 221, radius: 46 };
const SNAIL_FRAME_MS = 100;
const HELIX = { bodyTwists: [3, 22], shellTwists: [4, 30], sep: 0.075, rungEvery: 3, spinSpeed: 1.4 };
const ANTENNA = { look: 0.6, inSec: 0.35, holdSec: 0.6, outSec: 3.0, retract: 0.82, reach: 0.45 };
const SLIME = { perSec: 14, lifeMs: 3200, speed: [18, 46], size: [2, 5] };
const OUTLINE_POINTS = 160;
const TAIL_ANGLE = Math.PI - 0.55;
const HEAD_ANGLE = -0.5;
const SNAIL_TAU = Math.PI * 2;

function _tRgba(c, a) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function _tLerp(a, b, t) { return a + (b - a) * t; }
function _tSq(x) { return x * x; }
function _tAngDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
function snailWave(u, timeMs) { return 0.015 * Math.sin(u * 60 + timeMs / 300); }

function tScopeStroke(ctx, pts, closed, weight, ink, glow) {
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
  ctx.shadowBlur = 12 * weight * ctx.getTransform().a;
  ctx.strokeStyle = _tRgba(glow, 0.38);
  ctx.lineWidth = 8 * weight;
  draw();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = _tRgba(ink, 1);
  ctx.lineWidth = 2.1 * weight;
  draw();
  ctx.restore();
}

// SVart helixStroke 충실 포트: 호길이 파라미터화 이중나선
function tHelixStroke(ctx, pts, closed, twists, sep, weight, ink, glow, helixAmt, timeMs) {
  if (helixAmt < 0.01) return tScopeStroke(ctx, pts, closed, weight, ink, glow);
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
  tScopeStroke(ctx, A, false, weight, ink, glow);
  tScopeStroke(ctx, B, false, weight * 0.75, ink, glow);
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

class SnailArt {
  constructor(profile, seed, now) {
    this.profile = profile;
    this.seed = seed;
    this.born = now;
    this.canvas = document.createElement('canvas');
    this.canvas.width = SNAIL_ART.width / 2;
    this.canvas.height = SNAIL_ART.height / 2;
    this.ctx = this.canvas.getContext('2d');
    this.nextFrame = now;
    this.particles = [];
    this.nextSlime = null;
    this.renderSprite(now);
    this.nextFrame = now + (seed % 1) * SNAIL_FRAME_MS;
  }

  body(timeMs) {
    const { tail, head, size } = this.profile;
    const { x, ground, radius } = SNAIL_ART;
    const R0 = radius * size;
    const time = timeMs / 1000;
    const flatY = R0 * 0.72 * 0.78;
    const cy = ground - flatY;
    const tailLen = R0 * (1.05 + 0.3 * tail);
    const tailLift = R0 * 0.75 * (tail + 1) / 2;
    const headLen = R0 * (0.75 + 0.35 * head);
    const pointAt = th => {
      const wob = 0.3 * (0.045 * Math.sin(3 * th + 1.1 * time) +
        0.03 * Math.sin(5 * th - 1.7 * time + 1) + 0.02 * Math.sin(2 * th + 0.6 * time));
      const r = R0 * (1 + wob);
      const wt = Math.exp(-_tSq(_tAngDiff(th, TAIL_ANGLE) / (0.32 + 0.2 * tail)));
      const wh = Math.exp(-_tSq(_tSq(_tAngDiff(th, HEAD_ANGLE) / (0.4 + 0.14 * head))));
      const px = r * Math.cos(th) * 1.16 - tailLen * wt + tailLift * 0.12 * wt ** 3 + headLen * wh * 0.9;
      const py = r * Math.sin(th) * 0.78 + 0.25 * tailLen * wt - tailLift * wt ** 2 - headLen * wh * 0.45;
      return { x: x + px, y: cy + (py > flatY ? flatY + (py - flatY) * 0.2 : py) };
    };
    const pts = Array.from({ length: OUTLINE_POINTS }, (_, i) => pointAt(i / OUTLINE_POINTS * SNAIL_TAU));
    return { pts, R0, headTip: pointAt(HEAD_ANGLE) };
  }

  antennae(shape, time) {
    const { head, dominantEar } = this.profile;
    const { inSec, holdSec, outSec, retract, reach } = ANTENNA;
    const exploreSec = 4.5;
    let p = time % (exploreSec + inSec + holdSec + outSec);
    let length = 1 - retract, explore = 0, knob = 0;
    if (p < exploreSec) {
      const q = p / exploreSec;
      length = 1 + reach * q * q * (3 - 2 * q);
      explore = Math.min(1, p / 1.5);
      knob = 1;
    } else if ((p -= exploreSec) < inSec) {
      const r = Math.sin(p / inSec * Math.PI / 2);
      length = _tLerp(1 + reach, 1 - retract, r);
      explore = 1 - r;
      knob = Math.max(0, 1 - r * 2.5);
    } else if ((p -= inSec + holdSec) >= 0) {
      const q = p / outSec;
      length = 1 - retract * (1 - q) ** 2;
      knob = profileNumber((q - 0.55) / 0.3, 0, 1, 0);
    }

    const yaw = 0.6 * ANTENNA.look * Math.sin(time * 0.32);
    const { R0, headTip } = shape;
    return ['LEFT', 'RIGHT'].map(side => {
      const left = side === 'LEFT';
      const lat = left ? -1 : 1;
      const dominant = dominantEar === side;
      const ex = dominant ? explore : 0;
      const len = R0 * (0.66 + 0.25 * head) * (dominant ? length : 1);
      const el = (left ? 1.12 : 0.92) + 0.05 * Math.sin(time * 0.45 + (left ? 2.3 : 0))
        + ex * (0.28 * Math.sin(time * 0.55 + 0.4) + 0.08 * Math.sin(time * 1.1 + 2.1));
      const az = lat * 0.42 + ex * 0.45 * Math.sin(time * 0.38 + 1.3);
      const bow = 0.06 - ex * 0.05 * Math.cos(time * 0.55 + 0.4);
      const pts = Array.from({ length: 21 }, (_, i) => {
        const q = i / 20;
        const b = -bow * len * Math.sin(q * Math.PI);
        const forward = Math.cos(el) * len * q - Math.sin(el) * b;
        const X = -R0 * (left ? 0.2 : 0.03) + Math.cos(az) * forward;
        const Y = -R0 * (left ? 0.08 : 0.03) + Math.sin(el) * len * q + Math.cos(el) * b;
        const Z = lat * R0 * 0.06 + Math.sin(az) * forward;
        return {
          x: headTip.x - Math.abs(yaw) * R0 * 0.1 + X * Math.cos(yaw) + Z * Math.sin(yaw),
          y: headTip.y - Y,
          z: -X * Math.sin(yaw) + Z * Math.cos(yaw),
        };
      });
      return { pts, knob: dominant ? knob : 1 };
    }).sort((a, b) => a.pts[20].z - b.pts[20].z);
  }

  drawAntenna(ctx, stalk, R0, behind) {
    const { ink, glow } = this.profile;
    ctx.save();
    ctx.globalAlpha *= behind ? 0.5 : 1;
    tScopeStroke(ctx, stalk.pts, false, 0.9, ink, glow);
    if (stalk.knob > 0.05) {
      const tip = stalk.pts[20];
      ctx.strokeStyle = _tRgba(ink, 1);
      ctx.lineWidth = 1.5;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, R0 * 0.09 * stalk.knob, 0, SNAIL_TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = _tRgba(SNAIL_ACCENT, 1);
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, R0 * 0.035 * stalk.knob, 0, SNAIL_TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  draw(ctx, now) {
    const timeMs = Math.max(0, now - this.born) + this.seed * 1000;
    const { ink, glow, shellOffset, twist } = this.profile;
    const shape = this.body(timeMs);
    const { pts, R0 } = shape;
    const [behind, front] = this.antennae(shape, timeMs / 1000);
    const helix = twist === null ? 0 : 1;
    this.drawAntenna(ctx, behind, R0, true);

    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.beginPath();
    pts.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y));
    ctx.closePath();
    ctx.fill();
    const traced = pts.map((pt, i) => {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const w = snailWave(i / pts.length, timeMs) * R0 * 0.8;
      return { x: pt.x + dy / len * w, y: pt.y - dx / len * w };
    });
    tHelixStroke(ctx, traced, true, tTwistCount(HELIX.bodyTwists, twist), R0 * HELIX.sep, 1, ink, glow, helix, timeMs);
    this.drawAntenna(ctx, front, R0, false);

    if (shellOffset !== null) {
      const x = SNAIL_ART.x + shellOffset * R0, r = R0 * 0.72;
      let top = SNAIL_ART.ground;
      pts.forEach(pt => { if (Math.abs(pt.x - x) < R0 * 0.2) top = Math.min(top, pt.y); });
      const y = top - r * 0.9;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.02, 0, SNAIL_TAU);
      ctx.fill();
      const turns = 3 * SNAIL_TAU, spiral = [];
      for (let a = 0; a <= turns; a += 0.07) {
        const u = a / turns;
        const rr = r * (0.06 + 0.9 * u + snailWave(u, timeMs) * 0.35 * u);
        spiral.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
      }
      tHelixStroke(ctx, spiral, false, tTwistCount(HELIX.shellTwists, twist), r * HELIX.sep * 0.8, 1, ink, glow, helix, timeMs);
    }
    return pts.reduce((left, pt) => Math.min(left, pt.x), SNAIL_ART.x);
  }

  renderSprite(now) {
    if (now < this.nextFrame) return;
    this.nextFrame = now + SNAIL_FRAME_MS;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(0.5, 0.5);
    this.tailX = this.draw(ctx, now);
    ctx.restore();
  }

  updateSlime(now) {
    const mode = this.profile.pitchMode;
    if (!['F', 'B', 'H'].includes(mode)) return;
    this.particles = this.particles.filter(p => now - p.born < p.life);
    const interval = 1000 / SLIME.perSec;
    this.nextSlime = Math.max(this.nextSlime ?? now, now - 100);
    while (this.nextSlime <= now) {
      this.particles.push({
        x: this.tailX + random(-4, 10), y: SNAIL_ART.ground - random(0, 5),
        vx: random(...SLIME.speed), vy: random(-3, 3), size: random(...SLIME.size),
        born: this.nextSlime, life: SLIME.lifeMs * random(0.6, 1),
        square: mode === 'F' || (mode === 'B' && random() < 0.5),
      });
      this.nextSlime += interval;
    }
  }

  drawSlime(ctx, now) {
    for (const p of this.particles) {
      const age = Math.max(0, now - p.born);
      if (age >= p.life) continue;
      const k = 1 - age / p.life;
      const drag = 0.005 * 60;
      const x = p.x - p.vx * (1 - Math.exp(-age / 1000 * drag)) / drag;
      const y = p.y + p.vy * age / 1000;
      const r = p.size * (0.6 + 0.4 * k);
      ctx.fillStyle = _tRgba(this.profile.ink, 0.8 * k);
      if (p.square) ctx.fillRect(x - r, y - r, r * 2, r * 2);
      else { ctx.beginPath(); ctx.arc(x, y, r, 0, SNAIL_TAU); ctx.fill(); }
    }
  }
}
