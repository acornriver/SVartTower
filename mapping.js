/**
 * SVart dev 결과 화면의 프로필 변환 (visuals.js, part2_audio.js).
 */
const SNAIL_PALETTE_RGB = [
  '#B19E6B', '#808E30', '#5C6A36', '#8C7256', '#A8765C',
  '#978A87', '#C4B8B0', '#A8B0C1', '#7CA0BA', '#6C9AD1',
].map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
const SNAIL_INK = [245, 245, 240];
// 달팽이 무지개 색 (SVart visuals.js의 SNAIL_RAINBOW · rainbowColor와 같은 값, 11/15). 색상은 SVart가 profile.hueDeg로 보냄
const SNAIL_RAINBOW = { sat: 0.85, light: 0.64 };
function rainbowColor(hue) {
  const { sat, light } = SNAIL_RAINBOW;
  const c = (1 - Math.abs(2 * light - 1)) * sat, h = (((hue % 360) + 360) % 360) / 60, x = c * (1 - Math.abs(h % 2 - 1)), m = light - c / 2;
  const rgb = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return rgb.map(v => Math.round((v + m) * 255));
}
const SNAIL_ACCENT = [255, 59, 31];

function profileNumber(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function mapProfile(profile, version) {
  const p = profile || {};
  const center = profileNumber(p.centerDeg, -30, 30, null);
  let ink = SNAIL_INK;
  const hue = profileNumber(p.hueDeg, 0, 360, null);
  if (hue !== null) ink = rainbowColor(hue);   // 새 문서: 무지개
  else if (center !== null) {                  // hueDeg가 없는 예전 문서: 북서울 팔레트 그대로
    const x = (center + 30) / 60 * (SNAIL_PALETTE_RGB.length - 1);
    const i = Math.min(SNAIL_PALETTE_RGB.length - 2, Math.floor(x));
    ink = SNAIL_PALETTE_RGB[i].map((c, k) => c + (SNAIL_PALETTE_RGB[i + 1][k] - c) * (x - i));
  }
  const hz = profileNumber(p.maxFreqHz, 8000, 20000, null);
  const legacyTwist = version === 1 && hz !== null ? (hz - 8000) / 12000 : null;
  return {
    size: 0.72 + 0.56 * (profileNumber(p.volDb, -40, 0, -20) + 40) / 40,
    tail: profileNumber(p.lowDb, -10, 10, 0) / 10,
    head: profileNumber(p.highDb, -10, 10, 0) / 10,
    shellOffset: ({ LOW: -0.75, MID: 0, HIGH: 0.7 })[p.register] ?? null,
    twist: profileNumber(p.twistAmount, 0, 1, legacyTwist),
    dominantEar: p.dominantEar,
    pitchMode: p.pitchMode,
    ink,
    glow: hue === null && center === null ? SNAIL_ACCENT : ink,
  };
}
