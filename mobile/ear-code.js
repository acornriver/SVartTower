/** SVart dev earCode.js의 v2 코드와 음역 EQ 값. */
const EAR_REGISTER = {
  O: { id: 'LOW', freq: 100 }, A: { id: 'MID', freq: 400 }, I: { id: 'HIGH', freq: 2500 },
};

function parseMobileCode(raw) {
  const input = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  const code = input.replace(/K(?=\/)/g, 'k');
  const match = /^([OAI])([TEW])([VES])-?([LCR·])([LR·])([FBH·])(?:\((\d{1,2}(?:\.\d)?|–)k\/([0-9])\))?$/.exec(code);
  if (!match) return null;
  const [, register, low, high, center, ear, pitch, frequency, volume] = match;
  const hz = Number(frequency) * 1000;
  if (frequency && frequency !== '–' && (hz < 8000 || hz > 20000)) return null;
  const maxFreqHz = Number.isFinite(hz) ? hz : null;
  const letters = `${register}${low}${high}-${center}${ear}${pitch}`;
  return {
    code: volume === undefined ? letters : `${letters}(${frequency}k/${volume})`,
    v: 2,
    profile: {
      register: EAR_REGISTER[register].id,
      lowDb: ('TEW'.indexOf(low) - 1) * 8,
      highDb: ('VES'.indexOf(high) - 1) * 8,
      centerDeg: ({ L: -30, C: 0, R: 30 })[center] ?? null,
      dominantEar: ({ L: 'LEFT', R: 'RIGHT' })[ear] ?? null,
      pitchMode: pitch === '·' ? null : pitch,
      maxFreqHz,
      twistAmount: maxFreqHz === null ? null : (maxFreqHz - 8000) / 12000,
      volDb: volume === undefined ? null : -40 * (1 - Number(volume) / 9),
    },
  };
}

function comparisonSettings(profile) {
  const register = Object.values(EAR_REGISTER).find(value => value.id === profile.register);
  return [
    { type: 'lowshelf', freq: 200, db: profileNumber(profile.lowDb, -10, 10, 0) },
    { type: 'peaking', freq: register?.freq ?? 400, db: register ? 3 : 0 },
    { type: 'highshelf', freq: 4000, db: profileNumber(profile.highDb, -10, 10, 0) },
  ];
}
