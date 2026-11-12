/**
 * 청감 타워 — 피드 연결, 무대 관리, 디버그 창, 운영용 장치
 *
 * 화면은 tower.js(ref/sketch (14).js 포트, 네온 버전)가 그립니다. 여기서는 cloud/feed.js에서 받은 귀를
 * 달팽이 그림으로 만들어 타워에 접속시킵니다. mapping.js와 snail-sticker.js가 결과 화면의 외형을 만듭니다.
 * 11/12 사용자 선택: 소개 카드와 마리 수 글자는 뺌 (스케치의 인식 박스·청감 코드 이름표가 대신함).
 */
'use strict';

const POOL_MAX         = 500;     // 대기 풀 최대 크기
const ROTATE_EVERY     = 20000;   // 무대 교체 간격 ms (임시, Claude가 정함)
const ARRIVE_QUEUE_GAP = 2000;    // 여러 마리가 한꺼번에 올 때 간격 ms
const BUILD_EVERY_MS    = 60;      // 달팽이 그림 하나를 만드는 간격 (처음 불러올 때 화면이 멈추지 않게)
const RELOAD_HOUR      = 5;       // 새벽 5시 새로고침
const DEFAULT_HZ       = 14000;   // maxFreqHz가 없을 때 앉는 높이 (mapping.js의 기본값과 같음)

let earPool = [];          // 무대에 못 올라간 귀 (최근 POOL_MAX개)
let buildQueue = [];       // { ear, animate } 달팽이 그림을 만들 차례
let arriveAt = 0;          // 다음 도착을 띄울 수 있는 시각
let totalCount = 0;
let rotateTimer = 0;
let debugMode = false;
let feedStarted = false;

const onTower = () => snails.filter(sn => sn.ear);
const knownIds = () => new Set([...onTower().map(sn => sn.ear.earId), ...earPool.map(e => e.earId), ...buildQueue.map(b => b.ear.earId)]);

function hashSeed(id) {
  let h = 7;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 100000;
  return h / 100;
}

/* ───────────── 피드 ───────────── */
window.towerReady = function () {
  if (feedStarted) return;
  feedStarted = true;
  scheduleReload();
  acquireWakeLock();
  rotateTimer = millis();
  setInterval(buildNext, BUILD_EVERY_MS);
  const cached = window.svartFeed?.getFeedCache?.() || [];
  if (cached.length) onInitial(cached);
  window.svartFeed.startFeed({ onInitial, onArrive, onRemove, onCount: n => { totalCount = n; } });
};

function onInitial(list) {
  const known = knownIds();
  const fresh = list.filter(e => !known.has(e.earId));
  const room = Math.max(0, CFG.MAX_SNAILS - onTower().length - buildQueue.length);
  fresh.slice(0, room).forEach(ear => buildQueue.push({ ear, animate: false }));
  earPool = [...fresh.slice(room), ...earPool].slice(0, POOL_MAX);
}

function onArrive(ear, { animate }) {
  if (knownIds().has(ear.earId)) return;
  if (!animate) {
    earPool.unshift(ear);
    if (earPool.length > POOL_MAX) earPool.pop();
    return;
  }
  buildQueue.unshift({ ear, animate: true });   // 새로 온 달팽이가 먼저
}

function onRemove(earId) {
  for (let i = snails.length - 1; i >= 0; i--) if (snails[i].ear?.earId === earId) snails.splice(i, 1);
  earPool = earPool.filter(e => e.earId !== earId);
  buildQueue = buildQueue.filter(b => b.ear.earId !== earId);
  fillFromPool();
}

/* ───────────── 무대 ───────────── */
function fillFromPool() {
  while (earPool.length && onTower().length + buildQueue.length < CFG.MAX_SNAILS) {
    buildQueue.push({ ear: earPool.shift(), animate: false });
  }
}

// 귀 하나를 달팽이 그림으로 만들어 타워에 올림. animate면 포탈로 접속해 들어옴
function putOnTower(ear, animate) {
  const profile = mapProfile(ear.profile, ear.v ?? ear.codeVersion);
  const art = new SnailArt(profile, hashSeed(ear.earId), millis());
  const raw = ear.profile?.maxFreqHz;
  const hz = typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_HZ;
  const sn = addSnail(hz, art.canvas, ear.earId, animate);   // MAX_SNAILS를 넘으면 가장 오래된 달팽이가 빠짐
  sn.ear = ear;
  sn.art = art;
  sn.code = ear.code || null;                          // 이름표는 청감 코드
  sn.sz = 1; // 볼륨에 따른 크기는 SVart 렌더러에서 적용
  if (!animate) sn.pause = millis() / 1000 + random(0, 3);
}

// 달팽이 그림 만들기. 한꺼번에 만들면 화면이 멈칫해서 타이머로 하나씩 한다. 도착은 2초 간격으로
function buildNext() {
  if (!buildQueue.length) return;
  const nowMs = millis();
  if (buildQueue[0].animate && nowMs < arriveAt) return;
  const job = buildQueue.shift();
  if (job.animate) arriveAt = nowMs + ARRIVE_QUEUE_GAP;
  try { putOnTower(job.ear, job.animate); } catch (e) { console.warn('[tower] 달팽이 그림을 못 만듦', job.ear.earId, e); }
}

function tick(nowMs) {
  // 무대 교체: 가장 오래 있던 한 마리가 내려가고 풀에서 한 마리가 올라옴
  if (nowMs - rotateTimer > ROTATE_EVERY) {
    rotateTimer = nowMs;
    const i = snails.findIndex(sn => sn.ear);
    if (earPool.length && i >= 0 && onTower().length >= CFG.MAX_SNAILS) snails.splice(i, 1);
    fillFromPool();
  }
}

window.towerOverlay = function () {
  tick(millis());
  updateDebug();
};

/* ───────────── 키, 디버그, 장시간 운영 ───────────── */
const IS_MOCK = location.search.includes('mock=1');
const IS_EMULATOR = location.search.includes('emulator=1');
const DBG_KEYS = [
  ['D', '이 창 열기/닫기'], ['F', '전체화면'], ['R', '달팽이 비우기'],
  ['B', '인식 박스·이름표 켜기/끄기'], ['O', '자동 회전 켜기/끄기'], ['P', '다변기 부품 떨어뜨리기'],
  ['드래그', '타워 돌리기'], ['스페이스', '시험 달팽이 한 마리 (이 창이 열려 있을 때)'],
];
let dbgStats = null;
let dbgButtons = [];
let dbgSnailSelect;
let dbgSnailPreview;
let dbgSnailOptions = [];
let dbgSelectedSnail = '';

window.towerKey = function (k) {
  if (k === 'f' || k === 'F') fullscreen(!fullscreen());
  if (k === 'r' || k === 'R') resetAll();
  if (k === 'd' || k === 'D') toggleDebug();
  if (k === ' ' && debugMode) sendLocalTestSnail();
};

function toggleDebug() {
  debugMode = !debugMode;
  const panel = document.getElementById('debug-panel');
  if (!dbgStats) buildDebugPanel(panel);
  panel.classList.toggle('visible', debugMode);
  if (debugMode) updateDebug();
  document.body.classList.toggle('debug', debugMode);   // 마우스 커서 보이기
}

// 지금 주소에서 mock·emulator만 바꿔 다시 엶
function switchMode(mode) {
  const q = new URLSearchParams(location.search);
  q.delete('mock'); q.delete('emulator'); q.delete('arrive');
  if (mode === 'mock') { q.set('mock', '1'); q.set('arrive', '15'); }
  if (mode === 'emulator') q.set('emulator', '1');
  const qs = q.toString();
  location.href = location.pathname + (qs ? '?' + qs : '');
}

// 이 화면에만 나오는 시험 달팽이. DB에 쓰지 않고 새로고침하면 사라짐
function sendLocalTestSnail() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const r = Math.random();
  const hz = r < 0.7 ? random(12000, 19000) : r < 0.9 ? random(8000, 12000) : random(19000, 20000);
  const id = 'LOCAL' + Math.random().toString(36).slice(2, 7).toUpperCase();
  buildQueue.unshift({
    animate: true,
    ear: {
      earId: id, code: '시험 달팽이', name: null, lang: 'ko', createdAt: Date.now(), hidden: false,
      profile: {
        volDb: random(-36, -6), lowDb: random(-8, 8), highDb: random(-8, 8), register: pick(['LOW', 'MID', 'HIGH']),
        maxFreqHz: Math.round(hz), twistAmount: (hz - 8000) / 12000, centerDeg: random(-60, 60), centerImage: pick(['L', 'C', 'R']),
        dominantEar: pick(['LEFT', 'RIGHT']), earStrength: random(40, 100), pitchMode: pick(['F', 'B', 'H']),
      },
    },
  });
}

function buildDebugPanel(panel) {
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const row = (title) => { const r = el('div', 'dbg-row'); r.appendChild(el('span', 'dbg-title', title)); panel.appendChild(r); return r; };
  const btn = (parent, label, onClick, isOn) => {
    const b = el('button', null, label);
    b.addEventListener('click', () => { onClick(); b.blur(); refreshDebugButtons(); });
    parent.appendChild(b);
    if (isOn) dbgButtons.push([b, isOn]);
    return b;
  };

  const mode = row('데이터');
  btn(mode, '실제 DB', () => switchMode('real'), () => !IS_MOCK && !IS_EMULATOR);
  btn(mode, '테스트(가짜)', () => switchMode('mock'), () => IS_MOCK);
  btn(mode, '에뮬레이터', () => switchMode('emulator'), () => IS_EMULATOR);

  const etc = row('기타');
  btn(etc, '자동 회전', () => { orbitOn = !orbitOn; }, () => orbitOn);
  btn(etc, '인식 박스', () => { CFG.BOXES = !CFG.BOXES; }, () => CFG.BOXES);
  btn(etc, '주파수 글자', () => { CFG.LABELS = !CFG.LABELS; }, () => CFG.LABELS);
  btn(etc, '부품 떨어뜨리기', dropPart);
  btn(etc, '시험 달팽이 보내기', sendLocalTestSnail);
  btn(etc, '달팽이 비우기', resetAll);
  btn(etc, '전체화면', () => fullscreen(!fullscreen()));

  const preview = row('달팽이');
  dbgSnailSelect = el('select');
  dbgSnailSelect.setAttribute('aria-label', '확대할 달팽이');
  dbgSnailSelect.addEventListener('change', () => {
    dbgSelectedSnail = dbgSnailSelect.value;
    updateSnailPreview(onTower());
  });
  preview.appendChild(dbgSnailSelect);
  dbgSnailPreview = el('canvas', 'dbg-snail-preview');
  dbgSnailPreview.width = 440;
  dbgSnailPreview.height = 244;
  dbgSnailPreview.setAttribute('aria-label', '선택한 달팽이 확대 보기');
  dbgSnailPreview.hidden = true;
  panel.appendChild(dbgSnailPreview);

  dbgStats = el('pre', 'dbg-stats');
  panel.appendChild(dbgStats);
  const keys = el('div', 'dbg-keys');
  DBG_KEYS.forEach(([k, what]) => { const line = el('div'); line.appendChild(el('b', null, k)); line.appendChild(el('span', null, what)); keys.appendChild(line); });
  panel.appendChild(keys);
  refreshDebugButtons();
}

function refreshDebugButtons() {
  dbgButtons.forEach(([b, isOn]) => b.classList.toggle('on', !!isOn()));
}

function resetAll() {
  for (let i = snails.length - 1; i >= 0; i--) if (snails[i].ear) snails.splice(i, 1);
  earPool = [];
  buildQueue = [];
}

function updateDebug() {
  if (!debugMode || !dbgStats) return;
  const stage = onTower();
  updateSnailPreview(stage);
  if (frameCount % 15 === 0) refreshDebugButtons();   // 키로 바꾼 것도 버튼에 반영
  dbgStats.textContent = [
    `모드: ${IS_MOCK ? '테스트(가짜 데이터)' : IS_EMULATOR ? '에뮬레이터' : '실제 DB'}`,
    `fps: ${frameRate().toFixed(1)}`,
    `타워: ${stage.length}/${CFG.MAX_SNAILS}   풀: ${earPool.length}   만들 차례: ${buildQueue.length}`,
    `총: ${totalCount}   피드 재연결: ${window._feedReconnectCount ?? 0}`,
    towerStatus(),
  ].join('\n');
}

function updateSnailPreview(stage) {
  if (stage.length !== dbgSnailOptions.length || stage.some((sn, i) => sn !== dbgSnailOptions[i])) {
    dbgSnailOptions = stage;
    if (!stage.some(sn => sn.id === dbgSelectedSnail)) dbgSelectedSnail = '';
    dbgSnailSelect.replaceChildren(
      new Option(stage.length ? '달팽이 선택' : '타워에 달팽이 없음', ''),
      ...stage.map(sn => new Option(`${sn.code || '청감 코드 없음'} · ${sn.id}`, sn.id))
    );
    dbgSnailSelect.disabled = stage.length === 0;
    dbgSnailSelect.value = dbgSelectedSnail;
  }
  const snail = stage.find(sn => sn.id === dbgSelectedSnail);
  dbgSnailPreview.hidden = !snail;
  if (!snail) return;
  const preview = dbgSnailPreview.getContext('2d');
  const now = millis();
  preview.clearRect(0, 0, dbgSnailPreview.width, dbgSnailPreview.height);
  preview.save();
  preview.translate(68, 0);
  snail.art.drawSlime(preview, now);
  snail.art.draw(preview, now);
  preview.restore();
}

function acquireWakeLock() {
  if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(() => {});
}

function scheduleReload() {
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === RELOAD_HOUR && now.getMinutes() === 0) {
      fetch(location.href, { method: 'HEAD', cache: 'no-cache' })
        .then(r => { if (r.ok) location.reload(); })
        .catch(() => {});
    }
  }, 60000);
}

window._towerDebug = {
  get stage() { return onTower(); },
  get pool() { return earPool; },
  get queue() { return buildQueue; },
  get total() { return totalCount; },
};
