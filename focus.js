'use strict';
// 선택된 달팽이 크게 보기. 11/24 작가가 2번(표본 패널)을 골라 기본으로 켠다.
//   /wall/            표본 패널: 화면 오른쪽에 고정된 표본 카드 (기본)
//   /wall/?focus=0    끔
//   /wall/?focus=1    (시안) 돋보기: 달팽이 옆에 둥근 렌즈
//   /wall/?focus=3    (시안) 확대 인셋: 타워 반대편에 확대 사각형과 확대선
// V 키 = 시안 바꾸기(끔 → 1 → 2 → 3), N 키 = 다른 달팽이. 고르는 건 자동(9초마다, 새로 도착하면 그 달팽이).

const FOCUS = {
  mode: (() => {
    const q = new URLSearchParams(location.search);
    const m = Number(q.get('focus'));
    return q.has('focus') && Number.isInteger(m) && m >= 0 && m <= 3 ? m : 2;
  })(),
  HOLD: 9,          // 한 달팽이를 보여 주는 시간(초)
  FADE: 0.6,
  ART_W: 440, ART_H: 248,   // SnailArt 그림 틀 (휴대폰 화면과 같은 비율)
};
const FOCUS_INK = [236, 236, 230];
const focusState = { sn: null, at: 0, next: null, out: 0, lastBorn: 0 };

function focusCandidates() {
  return snails.filter(sn => sn.art && sn.box && !sn.hidden && sn.state === 'live' && sn.reveal >= 1 &&
    sn.box[0] > 40 && sn.box[0] + sn.box[2] < width - 40 && sn.box[1] > 40 && sn.box[1] + sn.box[3] < height - 40);
}

// 바꿀 때가 되면 다음 달팽이를 한 번 정하고, 지금 것이 사라진 뒤 바꾼다. 돌려주는 값은 보이는 정도(0~1)
function focusUpdate(now, force) {
  const st = focusState;
  if (st.sn && !snails.includes(st.sn)) { st.sn = null; }
  const OUT = FOCUS.FADE * 0.6;
  if (!st.next) {
    const list = focusCandidates();
    const fresh = list.filter(sn => sn.portal && sn.born > st.lastBorn).sort((a, b) => b.born - a.born)[0];
    let want = null;
    if (fresh) { st.lastBorn = fresh.born; want = fresh; }   // 새로 도착해서 다 나타난 달팽이 먼저
    else if (force || !st.sn || !list.includes(st.sn) || now - st.at >= FOCUS.HOLD) {
      const others = list.filter(sn => sn !== st.sn);
      want = others.length ? others[Math.floor(Math.random() * others.length)] : null;
      if (!want && st.sn && !list.includes(st.sn)) { st.next = null; st.out = now; st.sn = null; }
      if (!want && st.sn) st.at = now;   // 다른 후보가 없으면 지금 달팽이를 계속
    }
    if (want && want !== st.sn) { st.next = want; st.out = st.sn ? now : now - OUT; }
  }
  if (st.next && now - st.out >= OUT) { st.sn = st.next; st.at = now; st.next = null; }
  if (!st.sn) return 0;
  const fadeIn = sstep(0, 1, clampN((now - st.at) / FOCUS.FADE, 0, 1));
  const fadeOut = st.next ? 1 - clampN((now - st.out) / OUT, 0, 1) : 1;
  return fadeIn * fadeOut;
}

// 달팽이 그림을 (cx, cy) 가운데, 가로 w로 크게 그린다
function focusDrawArt(sn, cx, cy, w, alpha) {
  const k = w / FOCUS.ART_W;
  const nowMs = millis();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx - w / 2, cy - FOCUS.ART_H * k / 2);
  ctx.scale(k, k);
  ctx.translate(58, 2);
  ctx.globalCompositeOperation = 'lighter';
  sn.art.drawSlime(ctx, nowMs);
  sn.art.draw(ctx, nowMs);
  ctx.restore();
}

// 크게 그린 달팽이가 타워 위 달팽이의 몇 배인지 (그림 틀 440 중 달팽이 그림 폭 360)
function focusMag(drawW, boxW) { return (drawW * SNAIL_ART.width / FOCUS.ART_W / Math.max(boxW, 1)).toFixed(1); }

function focusInfo(sn) {
  const ear = sn.ear || {};
  const animal = window.SnailAnimal && ear.code ? window.SnailAnimal.fromCode(ear.code) : null;
  const t = ear.createdAt ? new Date(ear.createdAt) : null;
  return {
    code: sn.code || '청감 코드 없음',
    khz: (sn.hz / 1000).toFixed(1) + ' kHz',
    animal: animal ? animal.ko + ' 귀' : '',
    time: t ? String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') : '',
  };
}

const MONO = '"SF Mono", ui-monospace, Menlo, Consolas, monospace';
const SANS = '"Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif';
function focusText(str, x, y, size, col, a, align = 'left', font = MONO, weight = 500) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(col, a);
  ctx.fillText(str, x, y);
}
function focusLine(x1, y1, x2, y2, col, a, w = 1, dash = null) {
  ctx.setLineDash(dash || []);
  ctx.strokeStyle = rgba(col, a);
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);
}
function focusBrackets(x, y, w, h, len, col, a, lw = 1.5) {
  ctx.strokeStyle = rgba(col, a);
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.moveTo(cx + dx * len, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * len);
  }
  ctx.stroke();
}

/* ───── 시안 1: 돋보기 ───── */
function focusLoupe(sn, a, now) {
  const [bx, by, bw, bh] = sn.box;
  const sx = bx + bw / 2, sy = by + bh * 0.55;
  const col = colorAt(sn.s);
  const R = clampN(Math.min(width, height) * 0.17, 90, 230);
  const side = sx > width / 2 ? 1 : -1;
  const cx = clampN(sx + side * R * 1.9, R + 30, width - R - 30);
  const cy = clampN(sy - R * 0.9, R + 40, height - R - 80);
  const info = focusInfo(sn);

  ctx.globalCompositeOperation = 'source-over';
  // 달팽이 둘레 작은 원과 이어지는 선
  const r0 = Math.max(bw, bh) * 0.5;
  const ang = Math.atan2(cy - sy, cx - sx);
  ctx.strokeStyle = rgba(col, 0.8 * a); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(sx, sy, r0, 0, Math.PI * 2); ctx.stroke();
  focusLine(sx + Math.cos(ang) * r0, sy + Math.sin(ang) * r0, cx - Math.cos(ang) * (R + 10), cy - Math.sin(ang) * (R + 10), col, 0.6 * a, 1);

  // 렌즈 속
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${0.92 * a})`; ctx.fill();
  ctx.clip();
  for (let k = -3; k <= 3; k++) {
    focusLine(cx - R, cy + k * R / 3.5, cx + R, cy + k * R / 3.5, col, 0.06 * a);
    focusLine(cx + k * R / 3.5, cy - R, cx + k * R / 3.5, cy + R, col, 0.06 * a);
  }
  focusDrawArt(sn, cx, cy + R * 0.08, R * 2.05, a);
  ctx.restore();

  // 테와 눈금
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(col, 0.25 * a); ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(cx, cy, R + 1, 0, Math.PI * 2); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = rgba(mul(col, 1.2), 0.95 * a); ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = rgba(FOCUS_INK, 0.3 * a); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R + 9, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  for (let d = 0; d < 360; d += 6) {
    const t = d * Math.PI / 180 + now * 0.05, l = d % 30 === 0 ? 8 : 4;
    ctx.moveTo(cx + Math.cos(t) * (R + 9), cy + Math.sin(t) * (R + 9));
    ctx.lineTo(cx + Math.cos(t) * (R + 9 + l), cy + Math.sin(t) * (R + 9 + l));
  }
  ctx.stroke();

  // 글자
  const mag = focusMag(R * 2.05, bw);
  focusText('×' + mag, cx + R * 0.72, cy - R * 0.72 - 14, 11, FOCUS_INK, 0.6 * a, 'left');
  focusText(info.code, cx, cy + R + 34, 15, CFG.LABEL_COLOR, a, 'center');
  focusText([info.animal, info.khz].filter(Boolean).join('  ·  '), cx, cy + R + 56, 13, FOCUS_INK, 0.7 * a, 'center', SANS, 400);
}

/* ───── 시안 2: 표본 패널 ───── */
function focusPanel(sn, a) {
  const [bx, by, bw, bh] = sn.box;
  const col = colorAt(sn.s);
  const info = focusInfo(sn);
  const pw = clampN(width * 0.24, 260, 460);
  const artH = (pw - 48) * FOCUS.ART_H / FOCUS.ART_W;
  const ph = 64 + artH + 150;
  const px = width - pw - 40, py = (height - ph) / 2;

  ctx.globalCompositeOperation = 'source-over';
  // 타워 위 달팽이 표시와 연결선
  focusBrackets(bx - 6, by - 6, bw + 12, bh + 12, 9, FOCUS_INK, 0.9 * a);
  const sx = bx + bw + 6, sy = by + bh / 2, ex = px - 28;
  if (sx < ex) {
    focusLine(sx, sy, ex, sy, FOCUS_INK, 0.45 * a, 1, [2, 4]);
    focusLine(ex, sy, px, py + 32, FOCUS_INK, 0.45 * a, 1, [2, 4]);
  }

  // 패널
  ctx.fillStyle = `rgba(0,0,0,${0.88 * a})`;
  ctx.fillRect(px, py, pw, ph);
  focusBrackets(px, py, pw, ph, 18, FOCUS_INK, a);
  focusText('SELECTED EAR', px + 24, py + 32, 11, FOCUS_INK, 0.55 * a);
  focusText(info.time, px + pw - 24, py + 32, 11, FOCUS_INK, 0.55 * a, 'right');

  // 그림
  const ay = py + 56;
  ctx.save();
  ctx.beginPath(); ctx.rect(px + 24, ay, pw - 48, artH); ctx.clip();
  for (let x = px + 24; x <= px + pw - 24; x += 16) for (let y = ay; y <= ay + artH; y += 16) {
    ctx.fillStyle = rgba(FOCUS_INK, 0.08 * a); ctx.fillRect(x, y, 1, 1);
  }
  focusDrawArt(sn, px + pw / 2, ay + artH / 2, pw - 48, a);
  ctx.restore();

  // 정보
  let y = ay + artH + 22;
  focusLine(px + 24, y, px + pw - 24, y, FOCUS_INK, 0.2 * a);
  y += 28;
  focusText(info.code, px + 24, y, 20, CFG.LABEL_COLOR, a, 'left', MONO, 600);
  y += 34;
  focusText('귀', px + 24, y, 12, FOCUS_INK, 0.5 * a, 'left', SANS, 400);
  focusText(info.animal || '—', px + pw - 24, y, 14, FOCUS_INK, 0.9 * a, 'right', SANS, 500);
  y += 28;
  focusText('고역 한계', px + 24, y, 12, FOCUS_INK, 0.5 * a, 'left', SANS, 400);
  focusText(info.khz, px + pw - 24, y, 14, FOCUS_INK, 0.9 * a, 'right');
  // 8~20 kHz 막대
  y += 20;
  const x0 = px + 24, x1 = px + pw - 24, u = clampN((sn.hz - 8000) / 12000, 0, 1);
  for (let x = x0; x < x1; x += 2) {
    ctx.fillStyle = rgba(colorAt(hzToUnit(8000 + 12000 * (x - x0) / (x1 - x0))), 0.5 * a);
    ctx.fillRect(x, y, 1.5, 3);
  }
  ctx.fillStyle = rgba(mul(col, 1.3), a);
  ctx.fillRect(x0 + (x1 - x0) * u - 1.5, y - 5, 3, 13);
}

/* ───── 시안 3: 확대 인셋 ───── */
function focusInset(sn, a) {
  const [bx, by, bw, bh] = sn.box;
  const col = colorAt(sn.s);
  const info = focusInfo(sn);
  const iw = clampN(width * 0.3, 280, 560), ih = iw * FOCUS.ART_H / FOCUS.ART_W;
  const onLeft = bx + bw / 2 > width / 2;
  const ix = onLeft ? 40 : width - iw - 40;
  const iy = clampN(by + bh / 2 - ih / 2, 50, height - ih - 70);

  ctx.globalCompositeOperation = 'source-over';
  // 확대선: 달팽이 사각형 모서리 → 인셋 모서리
  const near = onLeft ? [bx, ix + iw] : [bx + bw, ix];
  ctx.fillStyle = rgba(col, 0.05 * a);
  ctx.beginPath();
  ctx.moveTo(near[0], by); ctx.lineTo(near[1], iy); ctx.lineTo(near[1], iy + ih); ctx.lineTo(near[0], by + bh);
  ctx.closePath(); ctx.fill();
  focusLine(near[0], by, near[1], iy, col, 0.55 * a, 1, [3, 3]);
  focusLine(near[0], by + bh, near[1], iy + ih, col, 0.55 * a, 1, [3, 3]);
  ctx.strokeStyle = rgba(mul(col, 1.2), 0.9 * a); ctx.lineWidth = 1.2;
  ctx.strokeRect(bx, by, bw, bh);

  // 인셋
  ctx.fillStyle = `rgba(0,0,0,${0.93 * a})`;
  ctx.fillRect(ix, iy, iw, ih);
  ctx.save();
  ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
  focusDrawArt(sn, ix + iw / 2, iy + ih / 2 + 6, iw * 0.98, a);
  for (let y = iy; y < iy + ih; y += 3) { ctx.fillStyle = `rgba(0,0,0,${0.18 * a})`; ctx.fillRect(ix, y, iw, 1); }
  ctx.restore();
  ctx.strokeStyle = rgba(mul(col, 1.2), 0.95 * a); ctx.lineWidth = 1.2;
  ctx.strokeRect(ix, iy, iw, ih);
  // 자 눈금
  ctx.strokeStyle = rgba(FOCUS_INK, 0.45 * a); ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= iw; x += 12) { const l = x % 60 === 0 ? 7 : 3; ctx.moveTo(ix + x, iy); ctx.lineTo(ix + x, iy + l); ctx.moveTo(ix + x, iy + ih); ctx.lineTo(ix + x, iy + ih - l); }
  for (let y = 0; y <= ih; y += 12) { const l = y % 60 === 0 ? 7 : 3; ctx.moveTo(ix, iy + y); ctx.lineTo(ix + l, iy + y); ctx.moveTo(ix + iw, iy + y); ctx.lineTo(ix + iw - l, iy + y); }
  ctx.stroke();

  const mag = focusMag(iw * 0.98, bw);
  focusText(info.code, ix + 16, iy + 22, 14, CFG.LABEL_COLOR, a);
  focusText('×' + mag, ix + iw - 16, iy + 22, 11, FOCUS_INK, 0.6 * a, 'right');
  focusText(info.animal, ix + 16, iy + ih - 20, 13, FOCUS_INK, 0.8 * a, 'left', SANS, 400);
  focusText(info.khz, ix + iw - 16, iy + ih - 20, 12, FOCUS_INK, 0.8 * a, 'right');
}

/* ───── 연결 ───── */
{
  const prevOverlay = window.towerOverlay;
  window.towerOverlay = function (now) {
    if (prevOverlay) prevOverlay(now);
    if (!FOCUS.mode) return;
    const a = focusUpdate(now, false);
    const sn = focusState.sn;
    if (!sn || a <= 0.01 || !sn.box) return;
    ctx.save();
    if (FOCUS.mode === 1) focusLoupe(sn, a, now);
    else if (FOCUS.mode === 2) focusPanel(sn, a);
    else focusInset(sn, a);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  };
  const prevKey = window.towerKey;
  window.towerKey = function (k) {
    if (prevKey) prevKey(k);
    if (k === 'v' || k === 'V') FOCUS.mode = (FOCUS.mode + 1) % 4;
    if (k === 'n' || k === 'N') focusUpdate(millis() / 1000, true);
  };
}
