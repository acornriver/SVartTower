/**
 * SVart dev 결과 화면의 프로필 변환 (visuals.js, part2_audio.js).
 */
const SNAIL_PALETTE_RGB = [
  '#B19E6B', '#808E30', '#5C6A36', '#8C7256', '#A8765C',
  '#978A87', '#C4B8B0', '#A8B0C1', '#7CA0BA', '#6C9AD1',
].map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
const SNAIL_INK = [245, 245, 240];
const SNAIL_ACCENT = [255, 59, 31];

function profileNumber(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function mapProfile(profile, version) {
  const p = profile || {};
  const center = profileNumber(p.centerDeg, -30, 30, null);
  let ink = SNAIL_INK;
  if (center !== null) {
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
    glow: center === null ? SNAIL_ACCENT : ink,
  };
}
