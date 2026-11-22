'use strict';

const get = id => document.getElementById(id);
const input = get('ear-code');
const player = get('player');
const play = get('play');
const seek = get('seek');
const preview = get('own-preview');
const previewCtx = preview.getContext('2d');
const comparison = new EarComparison(player);
const queryParams = new URLSearchParams(location.search);
const isMock = queryParams.get('mock') === '1';
// 곡 6개 (SVart 감상 화면과 같은 순서·이름). 작가 곡 3개는 곡이 오기 전까지 SVart와 같은 북서울 녹음을 임시로 씀
const TRACK_FILES = { wonwoori: 'water-road', felix: 'car', collab: 'walk-stair', water: 'water', 'train-go': 'train-go', 'car-move': 'car-move' };
const gallery = new Map();
let visibleEars = [];
let own = null;
let ownArt = null;
let selected = null;
let mix = 0; // 0 = 내 귀, 1 = 고른 달팽이의 귀
let inputRevision = 0;
let previewFrame = null;
let lastPaint = 0;
let animalFilter = null; // 동물 칩으로 고른 동물 id (null = 전체)

// 상태 문구는 번역 키로 남겨 두고 언어를 바꾸면 다시 채움
function status(id, key) {
  const element = get(id);
  element.dataset.key = key || '';
  element.textContent = key ? tr(key) : '';
  element.hidden = !key;
}

// 청감 코드로 고른 동물 (cloud/snailAnimal.js, SVart 결과 화면과 같은 규칙)
function animalOf(ear) {
  return ear && window.SnailAnimal ? window.SnailAnimal.fromCode(ear.code) : null;
}
function earLabel(ear) {
  const animal = animalOf(ear);
  return animal ? window.SnailAnimal.earName(animal, mobileLang) : '';
}

function drawArt(ctx, art, now, withSlime) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  const scale = Math.min(ctx.canvas.width / 440, ctx.canvas.height / 248);
  ctx.translate((ctx.canvas.width - 440 * scale) / 2, (ctx.canvas.height - 248 * scale) / 2);
  ctx.scale(scale, scale);
  ctx.translate(58, 2);
  if (withSlime) {
    art.updateSlime(now);
    art.drawSlime(ctx, now);
  }
  art.tailX = art.draw(ctx, now);
  ctx.restore();
}

function paintPreview(now) {
  previewFrame = null;
  if (!ownArt) return;
  if (now - lastPaint >= 1000 / 30) {
    drawArt(previewCtx, ownArt, now, true);
    lastPaint = now;
  }
  previewFrame = requestAnimationFrame(paintPreview);
}

function setOwn(result, messageKey) {
  own = result;
  if (own?.earId && selected?.earId === own.earId) selected = null;
  ownArt = result ? new SnailArt(mapProfile(result.profile, result.v ?? result.codeVersion), 0, performance.now()) : null;
  get('own-specimen').hidden = !ownArt;
  get('own-code').textContent = result?.code ?? '';
  refreshOwnAnimal();
  if (ownArt && previewFrame === null) previewFrame = requestAnimationFrame(paintPreview);
  status('code-status', messageKey);
  refreshGallery();
  refreshComparison();
}

// QR 주소의 code · hue (SVart tour.js의 towerMobileUrl). hue는 0~360 숫자일 때만 씀
const qrCode = parseMobileCode(queryParams.get('code') ?? '')?.code ?? null;
const qrHue = (() => { const raw = queryParams.get('hue'), n = Number(raw); return raw !== null && raw !== '' && Number.isFinite(n) && n >= 0 && n <= 360 ? n : null; })();

function useInput(commit = false) {
  const value = input.value.trim();
  const result = parseMobileCode(value);
  if (commit && result) input.value = result.code;
  // QR로 온 코드면 QR에 담긴 달팽이 색상도 입힘. 색은 코드에 없어서, 검사 결과를 못 불러와도 아이패드와 같은 색이 나오게 함 (11/15)
  if (result && qrHue !== null && result.code === qrCode) result.profile.hueDeg = qrHue;
  setOwn(result, result ? 'codeDrawn' : value && commit ? 'codeInvalid' : '');
}

input.addEventListener('input', () => { inputRevision++; useInput(); });
get('code-form').addEventListener('submit', event => {
  event.preventDefault();
  if (own?.earId && input.value === own.code) return;
  inputRevision++;
  useInput(true);
});

function makeCard(ear) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ear-card';
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 134;
  canvas.setAttribute('aria-hidden', 'true');
  const art = new SnailArt(mapProfile(ear.profile, ear.v ?? ear.codeVersion), 0, 0);
  drawArt(canvas.getContext('2d'), art, 0, false);
  const label = document.createElement('span');
  label.className = 'card-animal';
  const code = document.createElement('span');
  code.textContent = ear.code;
  button.dataset.animal = animalOf(ear)?.id ?? '';
  button.append(canvas, label, code);
  button.addEventListener('click', () => selectMobileEar(ear.earId));
  return button;
}

function selectMobileEar(id) {
  if (id === own?.earId) {
    input.focus();
    return;
  }
  const ear = visibleEars.find(item => item.earId === id);
  if (!ear) return;
  selected = ear;
  mix = 1; // 고르면 그 달팽이의 귀로 바로 들림. 슬라이더로 내 귀와 섞어 비교
  refreshGallery();
  refreshComparison();
  get('listen').scrollIntoView({ block: 'start' });
  get('listen-title').focus({ preventScroll: true });
}

function refreshGallery() {
  for (const [id, card] of gallery) {
    const ear = visibleEars.find(item => item.earId === id);
    card.querySelector('.card-animal').textContent = earLabel(ear);
    card.hidden = id === own?.earId || (animalFilter !== null && card.dataset.animal !== animalFilter);
    card.setAttribute('aria-pressed', String(selected?.earId === id));
  }
  renderChips();
}

// 동물 칩: 지금 목록에 있는 동물만, 마릿수와 함께. 누르면 그 동물 귀만 보임 (11/22 원우리 작가 요청)
function renderChips() {
  const box = get('animal-chips');
  if (!box || !window.SnailAnimal) return;
  const others = visibleEars.filter(ear => ear.earId !== own?.earId);
  const counts = new Map();
  for (const ear of others) { const id = animalOf(ear)?.id; if (id) counts.set(id, (counts.get(id) || 0) + 1); }
  if (animalFilter !== null && !counts.has(animalFilter)) animalFilter = null;
  const chips = [{ id: null, text: `${tr('all')} ${others.length}` },
    ...window.SnailAnimal.LIST.filter(a => counts.has(a.id)).map(a => ({ id: a.id, text: `${window.SnailAnimal.earName(a, mobileLang)} ${counts.get(a.id)}` }))];
  box.replaceChildren(...chips.map(chip => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = chip.text;
    button.setAttribute('aria-pressed', String(animalFilter === chip.id));
    button.addEventListener('click', () => { animalFilter = chip.id; refreshGallery(); });
    return button;
  }));
}

function refreshOwnAnimal() {
  const animal = animalOf(own);
  get('own-animal').textContent = animal ? earLabel(own) : '';
  get('own-animal-line').textContent = animal ? window.SnailAnimal.line(animal, mobileLang) : '';
}

function showEars(list) {
  const visible = list.filter(ear => ear.profile && typeof ear.code === 'string' && ear.code);
  visibleEars = visible;
  syncMobileTower(visible);
  const container = get('ears');
  const ids = new Set(visible.map(ear => ear.earId));
  for (const [id, card] of gallery) {
    if (!ids.has(id)) {
      card.remove();
      gallery.delete(id);
    }
  }
  visible.forEach((ear, index) => {
    let card = gallery.get(ear.earId);
    if (!card) {
      card = makeCard(ear);
      gallery.set(ear.earId, card);
    }
    if (container.children[index] !== card) container.insertBefore(card, container.children[index] || null);
  });
  if (selected && !ids.has(selected.earId)) selected = null;
  refreshGallery();
  refreshComparison();
  status('feed-status', visible.some(ear => ear.earId !== own?.earId) ? '' : 'feedEmpty');
}

function refreshComparison() {
  if (!selected) mix = 0;
  else if (!own) mix = 1;
  const slider = get('ear-mix');
  slider.disabled = !own || !selected;
  slider.value = String(mix);
  play.disabled = !own && !selected;
  if (play.disabled && !player.paused) player.pause();
  get('enter-code').hidden = !!own;
  updatePlayback();
  comparison.configure(own?.profile, selected?.profile, mix);
  get('comparison').textContent = selected
    ? tr('compareSelected')(`${earLabel(selected)} · ${selected.code}`.replace(/^ · /, ''), !!own)
    : tr('compareNone');
  const selectedAnimal = animalOf(selected);
  const otherName = selectedAnimal ? window.SnailAnimal.earName(selectedAnimal, mobileLang) : tr('otherEar');
  get('other-ear-label').textContent = otherName;
  slider.setAttribute('aria-valuetext', tr('mixValue')(tr('myEar'), otherName, Math.round(mix * 100)));
}

get('ear-mix').addEventListener('input', event => {
  mix = Number(event.target.value);
  refreshComparison();
});

function setTrack() {
  const track = get('track').value;
  if (TRACK_FILES[track]) player.src = `mobile/audio/${TRACK_FILES[track]}.m4a`;
}

function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function updatePlayback() {
  const hasDuration = Number.isFinite(player.duration) && player.duration > 0;
  seek.disabled = play.disabled || !hasDuration;
  seek.max = hasDuration ? player.duration : 0;
  seek.value = hasDuration ? player.currentTime : 0;
  const elapsed = formatTime(Number(seek.value));
  get('elapsed').textContent = elapsed;
  get('duration').textContent = hasDuration ? formatTime(player.duration) : '–:––';
  seek.setAttribute('aria-valuetext', hasDuration ? `${elapsed} / ${formatTime(player.duration)}` : elapsed);
  play.textContent = player.paused || player.ended ? tr('play') : tr('pause');
}

function startPlayback() {
  status('audio-status', '');
  if (!player.getAttribute('src')) setTrack();
  try {
    comparison.play().catch(playbackError);
  } catch (error) {
    playbackError(error);
  }
}

function playbackError(error) {
  if (error?.name === 'AbortError') return;
  if (!player.paused) player.pause();
  updatePlayback();
  status('audio-status', 'audioError');
}

play.addEventListener('click', () => {
  if (player.paused || player.ended) startPlayback();
  else player.pause();
});
seek.addEventListener('input', () => {
  if (!seek.disabled) player.currentTime = Number(seek.value);
  updatePlayback();
});
get('track').addEventListener('change', () => {
  const wasPlaying = !player.paused && !player.ended;
  setTrack();
  updatePlayback();
  if (wasPlaying) startPlayback();
});
for (const event of ['emptied', 'loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause', 'ended']) {
  player.addEventListener(event, updatePlayback);
}
player.addEventListener('error', () => playbackError());

async function loadGalleryAndQR() {
  const id = queryParams.get('ear');
  const fallback = queryParams.get('code');
  if (fallback) {
    input.value = fallback.slice(0, input.maxLength);
    useInput(true);
  }
  const validId = window.EarSchema.ID_PATTERN.test(id ?? '');
  const revision = inputRevision;
  if (validId) status('code-status', 'qrLoading');
  else if (id && !own) status('code-status', 'qrCheck');

  if (isMock) {
    let mockEars = [];
    window.svartFeed.startFeed({
      onInitial(list) { mockEars = list; showEars(mockEars); },
      onArrive(ear) { mockEars = [ear, ...mockEars].slice(0, 24); showEars(mockEars); },
    });
    if (validId) status('code-status', 'qrMock');
    return;
  }

  try {
    const [{ db }, firestore] = await Promise.all([
      window._initFirebase(),
      import(`${window.FIREBASE_BASE}/firebase-firestore.js`),
    ]);
    const ears = firestore.collection(db, 'ears');
    const recent = firestore.query(ears, firestore.where('hidden', '==', false),
      firestore.orderBy('createdAt', 'desc'), firestore.limit(24));
    firestore.onSnapshot(recent, snapshot => showEars(snapshot.docs.map(doc => ({ ...doc.data(), earId: doc.id }))),
      () => status('feed-status', 'feedError'));
    if (!validId) return;
    for (const wait of [0, 750, 1500]) {
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      if (revision !== inputRevision) return;
      const snapshot = await firestore.getDoc(firestore.doc(ears, id));
      if (revision !== inputRevision) return;
      const data = snapshot.data();
      if (data?.hidden === false && data.profile && typeof data.code === 'string' && data.code) {
        input.value = data.code;
        setOwn({ ...data, earId: id }, 'qrLoaded');
        return;
      }
    }
    status('code-status', own ? 'qrMissingWithCode' : 'qrMissing');
  } catch {
    if (!gallery.size) status('feed-status', 'feedError');
    if (validId && revision === inputRevision) status('code-status', own ? 'qrOfflineWithCode' : 'qrOffline');
  }
}

// 언어: QR의 lang=en 또는 위쪽 KO / EN 버튼 (mobile/i18n.js)
document.querySelectorAll('[data-lang-option]').forEach(button => button.addEventListener('click', () => setMobileLang(button.dataset.langOption)));
window.addEventListener('mobilelangchange', () => {
  for (const id of ['code-status', 'feed-status', 'audio-status']) status(id, get(id).dataset.key);
  refreshOwnAnimal();
  refreshGallery();
  refreshComparison();
});
applyStaticCopy();
status('feed-status', 'feedLoading');
refreshComparison();
loadGalleryAndQR();
