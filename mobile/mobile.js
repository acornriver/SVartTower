'use strict';

const get = id => document.getElementById(id);
const input = get('ear-code');
const player = get('player');
const play = get('play');
const preview = get('own-preview');
const previewCtx = preview.getContext('2d');
const comparison = new EarComparison(player);
const queryParams = new URLSearchParams(location.search);
const isMock = queryParams.get('mock') === '1';
const tracks = ['water', 'train-go', 'car-move'];
const gallery = new Map();
let own = null;
let ownArt = null;
let selected = null;
let side = 'own';
let inputRevision = 0;
let previewFrame = null;
let lastPaint = 0;

function status(id, message) {
  const element = get(id);
  element.textContent = message;
  element.hidden = !message;
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

function setOwn(result, message) {
  own = result;
  if (own?.earId && selected?.earId === own.earId) selected = null;
  ownArt = result ? new SnailArt(mapProfile(result.profile, result.v ?? result.codeVersion), 0, performance.now()) : null;
  preview.hidden = !ownArt;
  if (ownArt && previewFrame === null) previewFrame = requestAnimationFrame(paintPreview);
  status('code-status', message);
  refreshGallery();
  refreshComparison();
}

function useInput(commit = false) {
  const value = input.value.trim();
  const result = parseMobileCode(value);
  if (commit && result) input.value = result.code;
  setOwn(result, result ? '입력한 코드에서 달팽이와 근사 EQ를 만들었어요.' :
    value && commit ? '코드 형식을 확인해 주세요. 예시 IWS-RLF 또는 IWS-RLF(13.2k/6)' : '');
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
  label.textContent = ear.code;
  button.append(canvas, label);
  button.addEventListener('click', () => {
    selected = ear;
    refreshGallery();
    refreshComparison();
    get('listen-title').focus();
  });
  return button;
}

function refreshGallery() {
  for (const [id, card] of gallery) {
    card.hidden = id === own?.earId;
    card.setAttribute('aria-pressed', String(selected?.earId === id));
  }
}

function showEars(list) {
  const visible = list.filter(ear => ear.profile && typeof ear.code === 'string' && ear.code);
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
  status('feed-status', visible.some(ear => ear.earId !== own?.earId) ? '' : '아직 비교할 달팽이가 없어요.');
}

function refreshComparison() {
  if (!selected) side = 'own';
  get('own-eq').disabled = !own;
  get('other-eq').disabled = !own || !selected;
  get('own-eq').setAttribute('aria-pressed', String(side === 'own'));
  get('other-eq').setAttribute('aria-pressed', String(side === 'other'));
  play.disabled = !own;
  if (!own) {
    if (!player.paused) player.pause();
    player.hidden = true;
    play.hidden = false;
  }
  comparison.configure(own?.profile, selected?.profile, side);
  get('comparison').textContent = selected
    ? `선택한 달팽이 ${selected.code}${own ? ' · 재생 중 EQ를 바꿔 들어보세요.' : ' · 비교하려면 내 청감 코드를 입력하세요.'}`
    : '다른 달팽이를 선택하면 내 EQ와 비교할 수 있어요.';
}

for (const key of ['own', 'other']) {
  get(`${key}-eq`).addEventListener('click', () => { side = key; refreshComparison(); });
}

function setTrack() {
  const track = get('track').value;
  if (tracks.includes(track)) player.src = `audio/${track}.m4a`;
}

function startPlayback() {
  status('audio-status', '');
  if (!player.getAttribute('src')) setTrack();
  try {
    comparison.play().then(() => {
      player.hidden = false;
      play.hidden = true;
    }).catch(playbackError);
  } catch (error) {
    playbackError(error);
  }
}

function playbackError(error) {
  if (error?.name === 'AbortError') return;
  play.hidden = false;
  status('audio-status', '소리를 재생하지 못했어요. 다시 재생을 눌러 주세요.');
}

play.addEventListener('click', startPlayback);
get('track').addEventListener('change', () => {
  const wasPlaying = !player.paused;
  setTrack();
  if (wasPlaying) startPlayback();
});
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
  if (validId) status('code-status', 'QR에서 검사 결과를 불러오는 중이에요.');
  else if (id && !own) status('code-status', 'QR 주소를 확인하거나 청감 코드를 입력해 주세요.');

  if (isMock) {
    let mockEars = [];
    window.svartFeed.startFeed({
      onInitial(list) { mockEars = list; showEars(mockEars); },
      onArrive(ear) { mockEars = [ear, ...mockEars].slice(0, 24); showEars(mockEars); },
    });
    if (validId) status('code-status', '가짜 데이터 모드에서는 QR 검사 결과를 조회할 수 없어요.');
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
      () => status('feed-status', '달팽이 목록을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.'));
    if (!validId) return;
    for (const wait of [0, 750, 1500]) {
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      if (revision !== inputRevision) return;
      const snapshot = await firestore.getDoc(firestore.doc(ears, id));
      if (revision !== inputRevision) return;
      const data = snapshot.data();
      if (data?.hidden === false && data.profile && typeof data.code === 'string' && data.code) {
        input.value = data.code;
        setOwn({ ...data, earId: id }, 'QR에서 불러온 검사 결과를 사용 중이에요.');
        return;
      }
    }
    status('code-status', own ? '검사 결과를 아직 찾을 수 없어 코드의 근사 EQ를 사용 중이에요.' :
      '검사 결과를 찾을 수 없어요. 잠시 뒤 새로고침하거나 청감 코드를 입력해 주세요.');
  } catch {
    if (!gallery.size) status('feed-status', '달팽이 목록을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.');
    if (validId && revision === inputRevision) status('code-status', own
      ? '검사 결과에 연결하지 못해 코드의 근사 EQ를 사용 중이에요.'
      : '검사 결과에 연결하지 못했어요. 청감 코드를 직접 입력할 수 있어요.');
  }
}

refreshComparison();
loadGalleryAndQR();
