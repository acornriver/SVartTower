'use strict';

// 전시장 타워 렌더러에 모바일에서 이미 받아온 달팽이 목록을 연결한다.
CFG.DEFAULT_CONTROLS = false;
CFG.VIEW_SIZE = 690;
CFG.LABELS = false;
CFG.BOXES = false;

let towerEars = [];
let towerIsReady = false;
let towerHasEars = false;

function syncMobileTower(ears) {
  towerEars = ears;
  if (!towerIsReady) return;
  const ids = new Set(ears.map(ear => ear.earId));
  snails = snails.filter(snail => ids.has(snail.id));
  const current = new Set(snails.map(snail => snail.id));
  for (const ear of ears) {
    if (current.has(ear.earId)) continue;
    const now = millis();
    const art = new SnailArt(mapProfile(ear.profile, ear.v ?? ear.codeVersion), random(60), now);
    const hz = profileNumber(ear.profile.maxFreqHz, 8000, 20000, 14000);
    const snail = addSnail(hz, art.canvas, ear.earId, towerHasEars);
    snail.art = art;
    snail.code = ear.code;
    snail.sz = 1;
  }
  if (ears.length) towerHasEars = true;
}

function towerSnailAt(x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const snail of snails) {
    if (!snail.box || snail.hidden || snail.reveal < 0.75) continue;
    const [left, top, width, height] = snail.box;
    const cx = left + width / 2;
    const cy = top + height / 2;
    if (Math.abs(x - cx) > Math.max(22, width / 2) || Math.abs(y - cy) > Math.max(22, height / 2)) continue;
    const distance = (x - cx) ** 2 + (y - cy) ** 2;
    if (distance < bestDistance) {
      best = snail;
      bestDistance = distance;
    }
  }
  return best;
}

window.towerReady = function () {
  towerIsReady = true;
  frameRate(30);
  orbitOn = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  syncMobileTower(towerEars);
  const canvas = document.querySelector('#stage canvas');
  canvas.setAttribute('aria-hidden', 'true'); // 키보드·스크린 리더에서는 바로 아래 목록을 사용
  let gesture = null;

  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, axis: null };
    canvas.setPointerCapture(event.pointerId);
    pressOnCanvas = true;
  });
  canvas.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.axis && Math.hypot(dx, dy) > 8) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
    // 투영에서 카메라 각을 줄이면 타워 앞쪽이 오른쪽으로 이동한다.
    if (gesture.axis === 'horizontal') camA -= (event.clientX - gesture.lastX) * 0.012;
    gesture.lastX = event.clientX;
  });
  canvas.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const tapped = !gesture.axis && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= 8;
    gesture = null;
    pressOnCanvas = false;
    if (!tapped) return;
    const rect = canvas.getBoundingClientRect();
    const snail = towerSnailAt((event.clientX - rect.left) * width / rect.width,
      (event.clientY - rect.top) * height / rect.height);
    if (snail) selectMobileEar(snail.id);
  });
  function cancelGesture(event) {
    if (gesture?.id !== event.pointerId) return;
    gesture = null;
    pressOnCanvas = false;
  }
  canvas.addEventListener('pointercancel', cancelGesture);
  canvas.addEventListener('lostpointercapture', cancelGesture);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loop(); else noLoop(); });
    observer.observe(canvas);
  }
};
