/* =====================================================================
 * 청감타워 이스터에그 — 아날로그 다변기 실제 3D 파일(STL)이 바닥에 쓰레기처럼 떨어진다
 *
 * 붙이는 법: index.html에서 tower.js 바로 다음에 두 줄
 *   <script src="variator-parts.js"></script>   ← STL 47개를 줄인 와이어프레임 데이터
 *   <script src="variator-drop.js"></script>    ← 이 파일
 * tower.js는 고치지 않는다. tower.js의 addPart / dropPart / updateParts / drawPart를
 * 같은 이름으로 다시 정의해서, 회전체로 흉내 내던 부품 대신 실제 파일 모양을 그린다.
 * (P 키, 디버그 창의 '부품 떨어뜨리기', 16초마다 자동 낙하는 그대로 이 코드로 연결된다)
 *
 * tower.js에서 빌려 쓰는 것: parts, lastPart, CFG, TW, CAM, view, ctx, project, random, noise,
 *                           rgba, mul, mixN, sstep, unit3
 * ===================================================================== */

/* ───────────── 조절값 (tower.js의 CFG에 없으면 여기 값을 씀) ───────────── */
(function () {
  const D = {
    PARTS_START: 5,               // 처음부터 바닥에 놓여 있는 개수 (파일 단위)
    PART_INTERVAL: 16,            // 몇 초마다 하나씩 떨어지는지 (0 이면 자동으로 안 떨어짐)
    MAX_PARTS: 18,                // 바닥에 남겨 두는 조각 수 (넘으면 오래된 것부터 사라짐)
    PART_COLOR: [206, 214, 226],  // 실버
    PART_MM: 1.6,                 // 실물 1mm = 화면 세계 몇 단위 (타워 높이 600 기준. 1.6이면 몸통 36mm ≈ 58)
    PART_MIN: 14,                 // 가장 긴 변이 이보다 작으면 이만큼 키움 (마개처럼 아주 작은 조각)
    PART_MAX: 90,                 // 가장 긴 변이 이보다 크면 이만큼 줄임 (120mm 시험 조각판)
    PART_DETAIL_PX: 22,           // 화면에서 이보다 작게 보이면 굵은 윤곽선만 그림 (속도)
    PART_GLOW: 0.16,              // 윤곽선 밑 잔광 세기
    PART_MESH: 0.5,               // 나머지 면 선(STL 삼각형 결) 밝기
  };
  for (const k in D) { if (CFG[k] === undefined) { CFG[k] = D[k]; } }
})();

/* ───────────── 데이터 풀기 ───────────── */
const VARIATOR = (function () {
  const src = window.VARIATOR_PARTS;
  if (!src || !src.files) { console.warn('[variator] variator-parts.js가 없어 부품을 그리지 않습니다'); return { files: [] }; }
  const dec = (b64, Ctor) => {
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) { u8[i] = bin.charCodeAt(i); }
    return new Ctor(u8.buffer);
  };
  const files = src.files.map((f) => ({
    name: f.name,
    stage: f.stage,
    comps: f.comps.map((c) => {
      const q = dec(c.v, Int16Array), v = new Float32Array(q.length);
      for (let i = 0; i < q.length; i++) { v[i] = q[i] * src.quant; }
      return { v, n: q.length / 3, e: dec(c.e, Uint16Array), nf: c.nf, size: c.size, maxDim: Math.max(c.size[0], c.size[1], c.size[2]), rest: c.rest };
    }),
  }));
  return { files };
})();

/* ───────────── 3×3 회전 ───────────── */
// 열 벡터를 그대로 담는 [x축, y축, z축] 회전. 점 p → R·p
function vmMul(R, x, y, z) {
  return [R[0] * x + R[3] * y + R[6] * z, R[1] * x + R[4] * y + R[7] * z, R[2] * x + R[5] * y + R[8] * z];
}

// 방향 a를 방향 b로 돌리는 회전 (둘 다 단위 벡터)
function vmAlign(a, b) {
  const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let ax = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const s = Math.hypot(ax[0], ax[1], ax[2]);
  if (s < 1e-6) {
    if (c > 0) { return [1, 0, 0, 0, 1, 0, 0, 0, 1]; }
    ax = Math.abs(a[0]) < 0.9 ? [0, -a[2], a[1]] : [-a[2], 0, a[0]];   // 반대 방향: 아무 수직 축으로 180°
  }
  return vmAxis(unit3(ax), Math.atan2(s, c));
}

function vmAxis(k, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c, [x, y, z] = k;
  return [t * x * x + c, t * x * y + s * z, t * x * z - s * y,
          t * x * y - s * z, t * y * y + c, t * y * z + s * x,
          t * x * z + s * y, t * y * z - s * x, t * z * z + c];
}

function vmCompose(A, B) {   // A·B
  const o = new Array(9);
  for (let col = 0; col < 3; col++) {
    const r = vmMul(A, B[col * 3], B[col * 3 + 1], B[col * 3 + 2]);
    o[col * 3] = r[0]; o[col * 3 + 1] = r[1]; o[col * 3 + 2] = r[2];
  }
  return o;
}

function pickRest(rest) {
  let r = Math.random(), acc = 0;
  for (const p of rest) { acc += p[3]; if (r <= acc) { return p; } }
  return rest[0];
}

/* =====================================================================
 * tower.js 함수 다시 정의
 * ===================================================================== */

// 파일 하나를 골라 그 안의 조각(필터 링 4개처럼 여러 개일 수 있음)을 모두 떨어뜨린다
function addPart(falling, fileIndex) {
  if (!VARIATOR.files.length) { return null; }
  const fi = Number.isInteger(fileIndex) ? fileIndex % VARIATOR.files.length : Math.floor(Math.random() * VARIATOR.files.length);
  const file = VARIATOR.files[fi];
  const ang = random(Math.PI * 2);
  const rad = TW.RB + random(90, 300);
  const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad;
  const made = [];
  file.comps.forEach((comp, ci) => {
    // 크기: 실물 비율 그대로, 너무 작거나 큰 것만 범위 안으로
    let k = CFG.PART_MM;
    if (comp.maxDim * k < CFG.PART_MIN) { k = CFG.PART_MIN / comp.maxDim; }
    if (comp.maxDim * k > CFG.PART_MAX) { k = CFG.PART_MAX / comp.maxDim; }
    // 놓일 자세: 미리 계산한 안정 자세 중 하나를 바닥(-y)으로, 그다음 아무 방향으로 돌림
    const rp = pickRest(comp.rest);
    const R = vmCompose(vmAxis([0, 1, 0], random(Math.PI * 2)), vmAlign(unit3([rp[0], rp[1], rp[2]]), [0, -1, 0]));
    let minY = Infinity;
    for (let i = 0; i < comp.n; i++) {
      const y = vmMul(R, comp.v[i * 3], comp.v[i * 3 + 1], comp.v[i * 3 + 2])[1] * k;
      if (y < minY) { minY = y; }
    }
    const spread = file.comps.length > 1 ? 26 + comp.maxDim * k : 0;   // 여러 조각이면 흩어져 떨어짐
    const p = {
      file: fi, comp, R, k,
      x: cx + random(-spread, spread), z: cz + random(-spread, spread),
      rest: -minY + 0.5,
      y: 0, vy: 0, state: falling ? 'fall' : 'rest',
      spinAxis: unit3([random(-1, 1), random(-1, 1), random(-1, 1)]), spin: falling ? random(5, 9) : 0,
      col: mul(CFG.PART_COLOR, random(0.82, 1.08)), flash: 0, bounce: 0, ph: random(Math.PI * 2),
    };
    p.y = falling ? TW.H + random(120, 260) + ci * random(20, 60) : p.rest;
    parts.push(p);
    made.push(p);
  });
  while (parts.length > CFG.MAX_PARTS) { parts.shift(); }
  return made;
}

function dropPart(fileIndex) { return addPart(true, fileIndex); }

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
  let R = p.R;
  if (p.spin > 0) {
    // 떨어지는 동안은 구르다가, 바닥에 가까워질수록 놓일 자세로 돌아온다
    const ang = p.spin * (p.y - p.rest) * 0.012 + p.spin * 0.4 * Math.sin(now * 3 + p.ph);
    R = vmCompose(vmAxis(p.spinAxis, ang), p.R);
  }
  const c = p.comp, n = c.n, k = p.k, v = c.v;
  // project()를 정점마다 부르지 않고 같은 계산을 여기서 바로 (tower.js의 project와 같은 식)
  const ca = view.cosA, sa = view.sinA, ce = view.cosE, se = view.sinE;
  const sx = vmBuf.x.length >= n ? vmBuf.x : (vmBuf.x = new Float32Array(n * 2));
  const sy = vmBuf.y.length >= n ? vmBuf.y : (vmBuf.y = new Float32Array(n * 2));
  const r0 = R[0] * k, r1 = R[1] * k, r2 = R[2] * k, r3 = R[3] * k, r4 = R[4] * k, r5 = R[5] * k, r6 = R[6] * k, r7 = R[7] * k, r8 = R[8] * k;
  for (let i = 0; i < n; i++) {
    const x0 = v[i * 3], y0 = v[i * 3 + 1], z0 = v[i * 3 + 2];
    const X = p.x + r0 * x0 + r3 * y0 + r6 * z0;
    const Y = p.y + r1 * x0 + r4 * y0 + r7 * z0 - CAM.CY;
    const Z = p.z + r2 * x0 + r5 * y0 + r8 * z0;
    const x1 = X * ca - Z * sa, z1 = X * sa + Z * ca;
    const y2 = Y * ce - z1 * se, z2 = Y * se + z1 * ce;
    const kk = view.F / (CAM.D - z2);
    sx[i] = view.cx + x1 * kk;
    sy[i] = view.cy - y2 * kk;
  }
  const ctr = project([p.x, p.y, p.z]);
  const screenSize = c.maxDim * k * ctr[3];
  const fade = mixN(1, 0.45, sstep(CAM.D - 300, CAM.D + 380, ctr[2])) * (back ? 0.7 : 1);
  const flick = 0.82 + 0.18 * noise(p.ph, now * 1.7);       // 버려진 물건처럼 가끔 깜빡인다
  const alpha = (0.62 * flick + p.flash * 0.5) * fade;
  const all = c.e.length / 2;
  const nf = c.nf >= 24 ? c.nf : all;                        // 굵은 윤곽선 (너무 적으면 전부를 윤곽으로)
  const path = (from, to) => {
    ctx.beginPath();
    for (let j = from; j < to; j++) {
      const a = c.e[j * 2], b = c.e[j * 2 + 1];
      ctx.moveTo(sx[a], sy[a]);
      ctx.lineTo(sx[b], sy[b]);
    }
  };

  ctx.globalCompositeOperation = 'lighter';
  // 윤곽선: 잔광 + 밝은 선
  path(0, nf);
  ctx.strokeStyle = rgba(p.col, alpha * CFG.PART_GLOW);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = rgba(mul(p.col, 1.25), alpha * 0.9);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // 나머지 면 선: 옅게 (STL 삼각형 결이 보이는 정도). 아주 작게 보일 때는 생략
  if (nf < all && screenSize >= CFG.PART_DETAIL_PX) {
    path(nf, all);
    ctx.strokeStyle = rgba(p.col, alpha * CFG.PART_MESH * sstep(CFG.PART_DETAIL_PX, CFG.PART_DETAIL_PX * 1.6, screenSize));
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }

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
const vmBuf = { x: new Float32Array(1024), y: new Float32Array(1024) };

// 디버그용: 콘솔에서 VariatorDrop.list() 로 47개 이름 보기, VariatorDrop.drop(번호) 로 그 파일 떨어뜨리기
window.VariatorDrop = {
  list: () => VARIATOR.files.map((f, i) => i + ' ' + f.name),
  drop: (i) => dropPart(i),
  clear: () => { parts.length = 0; },
};
