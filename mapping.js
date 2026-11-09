/**
 * 청감 타워 — 프로필 → 달팽이 변환 (v2)
 *
 * ear.profile 필드를 타워 Snail이 쓰는 형식으로 변환한다.
 * SVart cloud/schema.js의 v2 프로필 기준.
 */

const SNAIL_PALETTE_HEX = [
  '#B19E6B','#808E30','#5C6A36','#8C7256','#A8765C',
  '#978A87','#C4B8B0','#A8B0C1','#7CA0BA','#6C9AD1'
];

// hex → [r, g, b] (0-255)
function hexRGB(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
const SNAIL_PALETTE_RGB = SNAIL_PALETTE_HEX.map(hexRGB);

/** u ∈ [0,1] → [r,g,b] (0-255). ⑥ 중앙 → 색 대응. */
function paletteAt(u) {
  u = Math.max(0, Math.min(1, u));
  const x = u * (SNAIL_PALETTE_RGB.length - 1);
  const i = Math.min(SNAIL_PALETTE_RGB.length - 2, Math.floor(x));
  const f = x - i;
  return [0, 1, 2].map(k => SNAIL_PALETTE_RGB[i][k] + f * (SNAIL_PALETTE_RGB[i + 1][k] - SNAIL_PALETTE_RGB[i][k]));
}

/** centerDeg (-180..180, +오른쪽) → [r,g,b]. 모르면 흰색 */
function centerColor(deg) {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return [245, 245, 243];
  const u = (Math.max(-90, Math.min(90, deg)) + 90) / 180;
  return paletteAt(u);
}

/**
 * ear.profile → 타워 Snail이 읽는 pf 객체 + 카드 표시용 _display
 * @param {object} profile  ear.profile (v2 스키마)
 * @returns {object}  pf
 */
function mapProfile(profile) {
  const p = profile || {};
  const MAX_HZ = 20000, MIN_HZ = 8000;

  // ── 크기 ──────────────────────────────────────────────────────────
  // volDb (-40..0) → 달팽이 크기 배율 0.55..1.05
  const volDb   = typeof p.volDb === 'number' ? p.volDb : -20;

  // ── 선 색 (⑥ centerDeg → SNAIL_PALETTE) ─────────────────────────
  const inkRGB  = centerColor(p.centerDeg);  // [r,g,b]
  const glowRGB = inkRGB;

  // ── 꼬임 (⑤ 고역한계 → 이중나선 꼬임) ───────────────────────────
  // maxFreqHz 8000→20000 : twistU 0→1
  const maxFreqHz = typeof p.maxFreqHz === 'number' && Number.isFinite(p.maxFreqHz)
    ? Math.max(MIN_HZ, Math.min(MAX_HZ, p.maxFreqHz)) : 14000;
  const twistU    = (maxFreqHz - MIN_HZ) / (MAX_HZ - MIN_HZ); // 0=저역, 1=고역

  // ── 우세 귀 (더듬이 길이·껍질 모양) ─────────────────────────────
  // LEFT → antR < antL, 껍질 네모; RIGHT → antL < antR, 껍질 둥근
  const dominantEar = p.dominantEar === 'LEFT' ? 'LEFT' : 'RIGHT';
  const earStrength = typeof p.earStrength === 'number' ? Math.max(0, Math.min(100, p.earStrength)) : 50;
  const shellSquare = dominantEar === 'LEFT' ? 1 : 0; // 1=네모, 0=둥근

  // ── 점액 (⑧ pitchMode → 모양) ───────────────────────────────────
  // F → 네모(square), H → 동그라미, B → 섞임
  const pitchMode   = p.pitchMode || null;

  // ── 앉는 잎 (EQ 위치) ─────────────────────────────────────────────
  const lowDb  = typeof p.lowDb  === 'number' ? p.lowDb  : 0;
  const highDb = typeof p.highDb === 'number' ? p.highDb : 0;

  // ── 카드 표시용 ───────────────────────────────────────────────────
  const dash = (v, fmt) => (v != null) ? fmt(v) : '—';
  const _display = {
    volDb:       dash(p.volDb,       v => v.toFixed(1) + ' dB'),
    register:    dash(p.register,    v => ({ LOW: 'A 낮음', MID: 'B 가운데', HIGH: 'C 높음' })[v] || v),
    lowDb:       dash(p.lowDb,       v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' dB'),
    highDb:      dash(p.highDb,      v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' dB'),
    maxFreqHz:   dash(p.maxFreqHz,   v => (v / 1000).toFixed(1) + ' kHz'),
    dominantEar: dash(p.dominantEar, v => ({ LEFT: '왼쪽', RIGHT: '오른쪽' })[v] || v),
    centerImage: dash(p.centerImage, v => ({ L: '왼쪽', C: '가운데', R: '오른쪽' })[v] || v),
    centerDeg:   dash(p.centerDeg,   v => (v >= 0 ? '+' : '') + v.toFixed(1) + '°'),
    pitchMode:   dash(p.pitchMode,   v => ({ F: '바탕음', B: '섞임', H: '배음' })[v] || v),
  };

  return {
    volDb, inkRGB, glowRGB,
    twistU,
    dominantEar, earStrength, shellSquare,
    pitchMode,
    lowDb, highDb,
    _display, _raw: p
  };
}

window.TowerMapping = { mapProfile, centerColor, paletteAt };
