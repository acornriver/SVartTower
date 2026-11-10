/**
 * 청감 타워 — 피드 연결, 무대 관리, 카드·마리 수, 운영용 장치
 *
 * 화면은 tower.js(ref/tower.js 포트)가 그립니다. 여기서는 cloud/feed.js에서 받은 귀를
 * 달팽이 스티커로 만들어 타워에 올립니다. cloud/와 mapping.js는 건드리지 않습니다.
 */
'use strict';

const POOL_MAX         = 500;     // 대기 풀 최대 크기
const ROTATE_EVERY     = 20000;   // 무대 교체 간격 ms (임시, Claude가 정함)
const CARD_EVERY       = 7000;    // 카드 순환 간격 ms (임시, Claude가 정함)
const ARRIVE_QUEUE_GAP = 2000;    // 여러 마리가 한꺼번에 올 때 간격 ms
const CARD_ARRIVE_HOLD = 14000;   // 도착 뒤 카드 고정 시간 ms (비행 8초 + 6초, Claude가 정함)
const BUILD_EVERY_MS    = 60;      // 스티커 하나를 만드는 간격 (처음 불러올 때 화면이 멈추지 않게)
const BURNIN_INTERVAL  = 2 * 60 * 1000;
const BURNIN_DRIFT     = 3;
const RELOAD_HOUR      = 5;       // 새벽 5시 새로고침
const DEFAULT_HZ       = 14000;   // maxFreqHz가 없을 때 앉는 높이 (mapping.js의 기본값과 같음)
const SIZE_BY_VOLUME   = [0.8, 1.2]; // volDb -40..0 → 스티커 크기 배율 (임시, Claude가 정함)

let earPool = [];          // 무대에 못 올라간 귀 (최근 POOL_MAX개)
let buildQueue = [];       // { ear, animate } 스티커를 만들 차례
let arriveAt = 0;          // 다음 도착을 띄울 수 있는 시각
let totalCount = 0;
let cardTarget = null;
let cardTimer = 0;
let cardLock = 0;
let rotateTimer = 0;
let debugMode = false;
let burnin = { x: 0, y: 0, nextAt: 0 };
let feedStarted = false;

const onTower = () => [...snails, ...arrivals.map(a => a.sn)].filter(sn => sn.ear);
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
  for (let i = arrivals.length - 1; i >= 0; i--) if (arrivals[i].sn.ear?.earId === earId) arrivals.splice(i, 1);
  earPool = earPool.filter(e => e.earId !== earId);
  buildQueue = buildQueue.filter(b => b.ear.earId !== earId);
  if (cardTarget?.ear.earId === earId) { cardTarget = null; cardTimer = 0; }
  fillFromPool();
}

/* ───────────── 무대 ───────────── */
function fillFromPool() {
  while (earPool.length && onTower().length + buildQueue.length < CFG.MAX_SNAILS) {
    buildQueue.push({ ear: earPool.shift(), animate: false });
  }
}

// 귀 하나를 스티커로 만들어 타워에 올림. animate면 종이비행기를 타고 옴
function putOnTower(ear, animate) {
  const pf = window.TowerMapping.mapProfile(ear.profile);
  const st = makeSnailSticker(pf, hashSeed(ear.earId));
  const raw = ear.profile?.maxFreqHz;
  const hz = typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_HZ;
  const sn = animate ? launchSnail(hz, st, ear.earId) : newSnail(hz, st, ear.earId);
  sn.ear = ear;
  sn.pf = pf;
  sn.sz = map(pf.volDb, -40, 0, SIZE_BY_VOLUME[0], SIZE_BY_VOLUME[1], true);
  if (!animate) {
    sn.pause = millis() / 1000 + random(0, 3);
    snails.push(sn);
    if (snails.length > CFG.MAX_SNAILS) snails.shift();
  } else {
    cardTarget = sn;
    cardLock = millis() + CARD_ARRIVE_HOLD;
    cardTimer = millis();
  }
}

// 스티커 만들기. 그리는 도중에 새 그래픽을 만들면 WEBGL 상태가 깨져서 draw 밖(타이머)에서 한다.
// 도착은 2초 간격으로
function buildNext() {
  if (!buildQueue.length) return;
  const nowMs = millis();
  if (buildQueue[0].animate && nowMs < arriveAt) return;
  const job = buildQueue.shift();
  if (job.animate) arriveAt = nowMs + ARRIVE_QUEUE_GAP;
  try { putOnTower(job.ear, job.animate); } catch (e) { console.warn('[tower] 스티커를 못 만듦', job.ear.earId, e); }
}

function tick(nowMs) {
  // 무대 교체: 가장 오래 있던 한 마리가 내려가고 풀에서 한 마리가 올라옴
  if (nowMs - rotateTimer > ROTATE_EVERY) {
    rotateTimer = nowMs;
    const i = snails.findIndex(sn => sn.ear);
    if (earPool.length && i >= 0 && onTower().length >= CFG.MAX_SNAILS) {
      if (cardTarget === snails[i]) { cardTarget = null; cardTimer = 0; }
      snails.splice(i, 1);
    }
    fillFromPool();
  }
  // 카드 순환
  const list = onTower();
  if (cardTarget && !list.includes(cardTarget)) cardTarget = null;
  if (nowMs > cardLock && (nowMs - cardTimer > CARD_EVERY || !cardTarget)) {
    const others = list.filter(sn => sn !== cardTarget);
    cardTarget = others.length ? others[Math.floor(Math.random() * others.length)] : (list[0] || null);
    cardTimer = nowMs;
  }
  // 번인 방지
  if (nowMs > burnin.nextAt) {
    const step = () => Math.round((Math.random() - 0.5) * BURNIN_DRIFT * 2);
    burnin.x = Math.max(-BURNIN_DRIFT, Math.min(BURNIN_DRIFT, burnin.x + step()));
    burnin.y = Math.max(-BURNIN_DRIFT, Math.min(BURNIN_DRIFT, burnin.y + step()));
    burnin.nextAt = nowMs + BURNIN_INTERVAL;
  }
}

/* ───────────── 카드와 아래 글자 (tower.js의 앞 레이어 fxL 위에 그림) ───────────── */
const FONT_KO = 'Noto Sans KR, system-ui, sans-serif';
const PAPER = [252, 250, 244];
const INK = [38, 36, 32];

window.towerOverlay = function (pg) {
  const nowMs = millis();
  tick(nowMs);
  drawCard(pg, nowMs);
  drawFooter(pg);
  updateDebug();
};

function drawCard(pg, nowMs) {
  const sn = cardTarget;
  if (!sn) return;
  const cfg = window.CloudConfig || {};
  const d = sn.pf._display || {};
  const arriving = arrivals.some(a => a.sn === sn);
  const lines = [
    ['청감 코드', sn.ear.code || '—'],
    ['볼륨 → 크기', d.volDb],
    ['음역', d.register],
    ['저음', d.lowDb],
    ['고음', d.highDb],
    ['최고 주파수 → 높이·꼬임', d.maxFreqHz],
    ['우세 귀', d.dominantEar],
    ['중앙 → 선 색', d.centerDeg],
    ['바탕음·배음', d.pitchMode],
  ];
  if (cfg.SHOW_NAMES && sn.ear.name) {
    let name = sn.ear.name;
    for (const w of (Array.isArray(cfg.BANNED_WORDS) ? cfg.BANNED_WORDS : [])) {
      name = name.replace(new RegExp(w, 'gi'), '*'.repeat(w.length));
    }
    lines.unshift(['이름', name.slice(0, cfg.NAME_MAX_LEN || 12)]);
  }

  const k = Math.max(0.8, Math.min(1.6, height / 900));   // 화면 높이에 맞춰 키움
  const lh = 21 * k, w = 250 * k, pad = 16 * k;
  const artW = w - pad * 2, artH = artW * sn.st.aspect;
  const h = pad + artH + 10 * k + lines.length * lh + pad + (arriving ? 16 * k : 0);
  const x = 28 * k + burnin.x;
  const y = height - h - 64 * k + burnin.y;

  pg.push();
  pg.noStroke();
  pg.fill(20, 16, 10, 60);                      // 종이 그림자
  pg.rect(x + 3 * k, y + 4 * k, w, h, 3 * k);
  pg.fill(PAPER[0], PAPER[1], PAPER[2]);        // 흰 종이
  pg.rect(x, y, w, h, 3 * k);
  let yy = y + pad;
  pg.textFont(FONT_KO);
  if (arriving) {
    pg.fill(214, 70, 40);
    pg.textSize(11 * k);
    pg.textAlign(LEFT, TOP);
    pg.text('▶ 방금 도착', x + pad, yy - 4 * k);
    yy += 16 * k;
  }
  pg.image(sn.st.img, x + pad, yy, artW, artH);  // 타워에 붙은 것과 같은 스티커
  yy += artH + 10 * k + lh / 2;
  pg.textSize(12 * k);
  lines.forEach(([label, val], i) => {
    const ly = yy + i * lh;
    pg.textAlign(LEFT, CENTER); pg.fill(124, 120, 110);
    pg.text(label, x + pad, ly);
    pg.textAlign(RIGHT, CENTER); pg.fill(INK[0], INK[1], INK[2]);
    pg.text(val || '—', x + w - pad, ly);
  });
  pg.pop();
}

function drawFooter(pg) {
  const k = Math.max(0.8, Math.min(1.6, height / 900));
  const n = totalCount > 0 ? totalCount : onTower().length;
  pg.push();
  pg.noStroke();
  pg.textFont(FONT_KO);
  pg.textSize(14 * k);
  const y = height - 22 * k + burnin.y;
  const put = (txt, x, align) => {
    pg.textAlign(align, BOTTOM);
    pg.fill(10, 10, 14, 150); pg.text(txt, x + 1, y + 1);   // 밝은 하늘에서도 읽히게 옅은 그림자
    pg.fill(255, 235); pg.text(txt, x, y);
  };
  put('청감 타워 · 달팽이 ' + n + '마리', 28 * k + burnin.x, LEFT);
  put('모든 귀는 [ ] 이다', width - 28 * k + burnin.x, RIGHT);
  pg.pop();
}

/* ───────────── 키, 디버그, 장시간 운영 ───────────── */
const IS_MOCK = location.search.includes('mock=1');
const IS_EMULATOR = location.search.includes('emulator=1');
const DBG_WEATHER = [[null, '실시간'], ['clear', '맑음'], ['cloud', '흐림'], ['rain', '비'], ['snow', '눈'], ['fog', '안개'], ['storm', '뇌우']];
const DBG_TIME = [[null, '실시간'], [7.1, '아침'], [12.5, '낮'], [17.3, '저녁'], [22, '밤']];
const DBG_KEYS = [
  ['D', '이 창 열기/닫기'], ['F', '전체화면'], ['R', '달팽이 비우기'],
  ['1~6', '맑음·흐림·비·눈·안개·뇌우'], ['0', '실시간 날씨'], ['T', '시간대 바꾸기'],
  ['O', '자동 회전 켜기/끄기'], ['H', '아래 상태 줄'], ['드래그', '타워 돌리기'],
  ['스페이스', '시험 달팽이 한 마리 (이 창이 열려 있을 때)'],
];
let dbgStats = null;
let dbgButtons = [];

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
        maxFreqHz: Math.round(hz), centerDeg: random(-60, 60), centerImage: pick(['L', 'C', 'R']),
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

  const wx = row('날씨');
  DBG_WEATHER.forEach(([kind, label]) => btn(wx, label, () => setWeatherOverride(kind), () => weatherOverride === kind));
  const tm = row('시간대');
  DBG_TIME.forEach(([h, label]) => btn(tm, label, () => setTimeOverride(h), () => hourOverride === h));

  const etc = row('기타');
  btn(etc, '자동 회전', () => { orbitOn = !orbitOn; }, () => orbitOn);
  btn(etc, '상태 줄', () => { hud = !hud; }, () => hud);
  btn(etc, '시험 달팽이 보내기', sendLocalTestSnail);
  btn(etc, '달팽이 비우기', resetAll);
  btn(etc, '전체화면', () => fullscreen(!fullscreen()));

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
  for (let i = arrivals.length - 1; i >= 0; i--) if (arrivals[i].sn.ear) arrivals.splice(i, 1);
  earPool = [];
  buildQueue = [];
  cardTarget = null;
}

function updateDebug() {
  if (!debugMode || !dbgStats) return;
  if (frameCount % 15 === 0) refreshDebugButtons();   // 키로 바꾼 것도 버튼에 반영
  dbgStats.textContent = [
    `모드: ${IS_MOCK ? '테스트(가짜 데이터)' : IS_EMULATOR ? '에뮬레이터' : '실제 DB'}`,
    `fps: ${frameRate().toFixed(1)}`,
    `타워: ${onTower().length}/${CFG.MAX_SNAILS} (날아오는 중 ${arrivals.length})`,
    `풀: ${earPool.length}   만들 차례: ${buildQueue.length}`,
    `종이비행기: ${pile.length}   총: ${totalCount}`,
    `피드 재연결: ${window._feedReconnectCount ?? 0}   번인: (${burnin.x}, ${burnin.y})`,
    towerStatus(),
  ].join('\n');
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
