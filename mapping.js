/**
 * 청감 타워 — 프로필 → 달팽이 변환
 *
 * 실제 ear.profile 필드를 cochlea-cloud.html의 Snail 생성자 입력 형식으로 바꾼다.
 * 변환 로직은 이 파일 한 곳에만 둔다.
 * 모든 대응에 // 임시 주석을 달았다. 원우리 작가 확인 후 확정한다.
 */

// 참조 코드(cochlea-cloud.html)의 색 팔레트 — 그대로 유지
const MAP_GROUND_RAMP = [[177, 158, 107], [128, 142, 48], [92, 106, 54], [140, 114, 86], [168, 118, 92]];
const MAP_SKY_RAMP    = [[151, 138, 135], [196, 184, 176], [168, 176, 193], [124, 160, 186], [108, 154, 209]];
const MAP_BONES       = { LOW: { rung: 3.2, bead: 4.6 }, MID: { rung: 1.8, bead: 3.0 }, HIGH: { rung: 0.8, bead: 1.7 } };

/**
 * ear.profile → Snail 생성자에 넘길 pf 객체
 * profile에 값이 없으면 중간값을 쓰고, 카드 표시용 _display에 "—"를 담는다.
 *
 * @param {object} profile  ear.profile
 * @returns {object}  pf (Snail이 읽는 형식) + _display (카드 표시용)
 */
function mapProfile(profile) {
  const p = profile || {};

  // ── Part 1 ──────────────────────────────────────────────────────

  // 임시: volDb 그대로 → 몸 크기. 참조 코드와 범위가 같음(-40~0)
  const volDb = (p.volDb != null) ? p.volDb : -20;

  // 임시: register 그대로 → 뼈 굵기. LOW/MID/HIGH 값이 같음
  const register = (p.register != null) ? p.register : 'MID';
  const bone = MAP_BONES[register] || MAP_BONES.MID;

  // 임시: lowDb/highDb 그대로 → 색, 앉는 잎. 범위 ±10dB로 같음
  const lowDb  = (p.lowDb  != null) ? p.lowDb  : 0;  // 임시: 없으면 0
  const highDb = (p.highDb != null) ? p.highDb : 0;  // 임시: 없으면 0

  // ── Part 2 ──────────────────────────────────────────────────────

  // 임시: maxFreqHz 8000~16000 → 참조 코드의 꼬임 범위(8000~20000) 전체에 다시 대응
  // 참조 코드는 8000~20000 기준이라 그대로 쓰면 가장 촘촘한 꼬임에 닿지 않음
  const maxFreqHz = (() => {
    if (p.maxFreqHz == null) return 14000;  // 임시: 없으면 중간값
    // 8000~16000 → 8000~20000 선형 대응
    return 8000 + (p.maxFreqHz - 8000) * (12000 / 8000); // 임시
  })();

  // 임시: dominantEar LEFT/RIGHT → 꼬임 방향. ALTERNATING 없음
  const dominantEar = (() => {
    if (p.dominantEar === 'LEFT')  return 'LEFT';
    if (p.dominantEar === 'RIGHT') return 'RIGHT';
    return 'RIGHT';  // 임시: null이면 오른쪽으로
  })();

  // 임시: centerImage L/C/R → 점액 모양 (별/도트/하트)
  // 참조 코드의 speech.yannyLaurel+jaCha → shape 대응 대신 직접 shape을 정함
  const slimeShape = (() => {
    if (p.centerImage === 'L') return 'star';    // 임시: L → 별
    if (p.centerImage === 'C') return 'dot';     // 임시: C → 도트
    if (p.centerImage === 'R') return 'heart';   // 임시: R → 하트
    return 'dot';  // 임시: null이면 도트
  })();

  // 임시: pitchMode F/B/H → 껍질 모양 (참조 코드에 별도 껍질 타입 없음)
  // 참조 코드의 speech.whaleSong A/B → burst(샤샤샥/점선) 대응 대신:
  // F → 샤샤샥(burst=true), B → 둘을 섞음(burst=random), H → 점선(burst=false)
  // 보고: 참조 코드에 pitchMode에 직접 대응하는 껍질 모양 파라미터가 없어서
  //       burst(파티클 흩어짐 여부)로 임시 대응함. 추후 shells 타입으로 분리 가능
  const burst = (() => {
    if (p.pitchMode === 'F') return true;   // 임시: F → 샤샤샥
    if (p.pitchMode === 'B') return null;   // 임시: B → 섞음(null=50%)
    if (p.pitchMode === 'H') return false;  // 임시: H → 점선
    return false;  // 임시: null이면 점선
  })();
  // burst=null이면 50% 확률로 결정
  const burstFinal = (burst === null) ? (Math.random() < 0.5) : burst;

  // 임시: profile.twistAmount는 Snail.twist(애니메이션 위상 값)와 다른 값이므로 사용하지 않음
  // (task 4장 명시)

  // ── 카드 표시용 ─────────────────────────────────────────────────
  const dash = (v, fmt) => (v != null) ? fmt(v) : '—';

  const _display = {
    volDb:       dash(p.volDb,       v => v.toFixed(1) + ' dB'),
    register:    dash(p.register,    v => ({ LOW: 'A 낮음', MID: 'B 가운데', HIGH: 'C 높음' })[v] || v),
    lowDb:       dash(p.lowDb,       v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' dB'),
    highDb:      dash(p.highDb,      v => (v >= 0 ? '+' : '') + v.toFixed(1) + ' dB'),
    maxFreqHz:   dash(p.maxFreqHz,   v => (v / 1000).toFixed(1) + ' kHz'),
    dominantEar: dash(p.dominantEar, v => ({ LEFT: '왼쪽', RIGHT: '오른쪽' })[v] || v),
    centerImage: dash(p.centerImage, v => ({ L: 'L (별)', C: 'C (도트)', R: 'R (하트)' })[v] || v),
    pitchMode:   dash(p.pitchMode,   v => ({ F: 'F 바탕음', B: 'B 섞임', H: 'H 배음' })[v] || v),
    sensitivity: dash(p.sensitivity, v => v.toFixed(0)),
    earStrength: dash(p.earStrength, v => v.toFixed(0)),
    pitchIndex:  dash(p.pitchIndex,  v => (v >= 0 ? '+' : '') + v.toFixed(0)),
  };

  // ── Snail 생성자 형식으로 반환 ───────────────────────────────────
  return {
    // Part 1 (참조 코드 형식 유지)
    volDb,
    register,
    bone,
    low:  lowDb,   // 임시: lowDb → low
    high: highDb,  // 임시: highDb → high
    // Part 2
    maxFreqHz,
    dominantEar,
    slimeShape,
    burst: burstFinal,
    // 카드 표시
    _display,
    // 원본 profile 보관 (디버그용)
    _raw: p
  };
}

window.TowerMapping = { mapProfile };
