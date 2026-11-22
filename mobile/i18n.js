'use strict';

// 관객용 화면 한국어 / English (11/22). 영어로 검사한 관람객은 SVart QR 주소에 lang=en이 붙어 영어로 열림.
// 위쪽 KO / EN 버튼으로도 바꿀 수 있고, 바꾸면 주소의 lang만 고쳐 새로고침해도 같은 언어로 열림.
const MOBILE_COPY = {
  ko: {
    pageTitle: '청감 타워 · 관객용',
    work: '모든 귀는 [   ] 이다', museum: '서울시립 북서울미술관',
    eyebrow: 'Cochlea Tower', title: '청감 타워', ownLink: '내 달팽이',
    high: '높은 소리', low: '낮은 소리', towerHelp: '좌우로 돌리고 달팽이를 눌러보세요.',
    feedLoading: '타워에 도착한 달팽이를 불러오는 중이에요.', feedEmpty: '아직 비교할 달팽이가 없어요.',
    feedError: '달팽이 목록을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.',
    pick: '동물별로 귀 고르기', all: '전체', earsLabel: '도착한 달팽이', chipsLabel: '동물로 고르기',
    ownTitle: '내 달팽이', codeLabel: '청감 코드', apply: '적용',
    codeHelp: '영문만 입력해도 달팽이가 나타나요. 예시 IWS-RLF(13.2k/6)', ownCanvas: '내 청감 코드로 그린 달팽이',
    codeDrawn: '입력한 코드로 달팽이를 그렸어요. 이 코드에 가까운 소리로 들을 수 있어요.',
    codeInvalid: '코드 형식을 확인해 주세요. 예시 IWS-RLF 또는 IWS-RLF(13.2k/6)',
    qrLoading: 'QR에서 검사 결과를 불러오는 중이에요.', qrCheck: 'QR 주소를 확인하거나 청감 코드를 입력해 주세요.',
    qrMock: '가짜 데이터 모드에서는 QR 검사 결과를 조회할 수 없어요.', qrLoaded: 'QR에서 불러온 검사 결과를 사용 중이에요.',
    qrMissingWithCode: '검사 결과를 아직 찾을 수 없어 입력된 코드에 가까운 소리로 들을 수 있어요.',
    qrMissing: '검사 결과를 찾을 수 없어요. 잠시 뒤 새로고침하거나 청감 코드를 입력해 주세요.',
    qrOfflineWithCode: '검사 결과에 연결하지 못해 입력된 코드에 가까운 소리로 들을 수 있어요.',
    qrOffline: '검사 결과에 연결하지 못했어요. 청감 코드를 직접 입력할 수 있어요.',
    back: '타워로 돌아가기', listenTitle: '청각 다변화 장치',
    compareNone: '타워나 동물 목록에서 달팽이를 고르면 그 귀로 들을 수 있어요.',
    compareSelected: (who, hasOwn) => `선택한 달팽이: ${who}${hasOwn ? ' · 재생 중 두 귀의 소리를 바꿔 들어보세요.' : ' · 내 청감 코드를 입력하면 두 귀의 소리를 비교할 수 있어요.'}`,
    enterCode: '내 청감 코드 입력', soundscape: '사운드스케이프',
    water: '당현천 물소리', 'train-go': '중계역 지하철', 'car-move': '북서울미술관 앞 지나가는 차',
    switchLabel: '들을 귀', ownEar: '내 귀로 듣기', otherEar: '이 달팽이의 귀로 듣기', otherEarNamed: ear => `${ear}로 듣기`,
    play: '재생', pause: '일시정지', seek: '재생 위치', audioError: '소리를 재생하지 못했어요. 다시 재생을 눌러 주세요.',
    towerAria: '회전하는 청감 타워', exploreAria: '청감 타워 둘러보기', langLabel: '언어'
  },
  en: {
    pageTitle: 'Hearing Tower · All Ears Are [ ]',
    work: 'All Ears Are [   ]', museum: 'Buk-Seoul Museum of Art',
    eyebrow: 'Cochlea Tower', title: 'Hearing Tower', ownLink: 'My snail',
    high: 'High', low: 'Low', towerHelp: 'Swipe to turn the tower, then tap a snail.',
    feedLoading: 'Loading the snails that reached the tower…', feedEmpty: 'No other snails to compare yet.',
    feedError: 'Couldn’t load the snails. Please refresh in a moment.',
    pick: 'Pick an ear by animal', all: 'All', earsLabel: 'Snails on the tower', chipsLabel: 'Pick by animal',
    ownTitle: 'My snail', codeLabel: 'Hearing code', apply: 'Apply',
    codeHelp: 'Just the letters are enough to draw a snail. e.g. IWS-RLF(13.2k/6)', ownCanvas: 'The snail drawn from my hearing code',
    codeDrawn: 'Drew a snail from your code. You can listen with a sound close to it.',
    codeInvalid: 'Please check the code. e.g. IWS-RLF or IWS-RLF(13.2k/6)',
    qrLoading: 'Loading your result from the QR code…', qrCheck: 'Check the QR link or type your hearing code.',
    qrMock: 'QR results aren’t available in mock data mode.', qrLoaded: 'Using the result from your QR code.',
    qrMissingWithCode: 'Your result isn’t here yet, so you’ll hear a sound close to your code.',
    qrMissing: 'Couldn’t find your result. Refresh in a moment or type your hearing code.',
    qrOfflineWithCode: 'Couldn’t reach your result, so you’ll hear a sound close to your code.',
    qrOffline: 'Couldn’t reach your result. You can type your hearing code instead.',
    back: 'Back to the tower', listenTitle: 'Sound Variator',
    compareNone: 'Pick a snail on the tower or from the animal list to listen with its ears.',
    compareSelected: (who, hasOwn) => `Selected: ${who}${hasOwn ? ' · Switch between the two while it plays.' : ' · Enter your hearing code to compare the two.'}`,
    enterCode: 'Enter my hearing code', soundscape: 'Soundscape',
    water: 'Danghyeoncheon Stream', 'train-go': 'Junggye Station subway', 'car-move': 'Cars outside Buk-Seoul Museum of Art',
    switchLabel: 'Ears to listen with', ownEar: 'Listen with my ears', otherEar: 'Listen with this snail’s ears', otherEarNamed: ear => `Listen with the ${ear}`,
    play: 'Play', pause: 'Pause', seek: 'Playback position', audioError: 'Couldn’t play the sound. Please press play again.',
    towerAria: 'The rotating Hearing Tower', exploreAria: 'Explore the Hearing Tower', langLabel: 'Language'
  }
};

let mobileLang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ko';

function tr(key) {
  return MOBILE_COPY[mobileLang][key] ?? MOBILE_COPY.ko[key];
}

// data-i18n(글자) · data-i18n-aria(aria-label) · data-i18n-placeholder를 지금 언어로 채움
function applyStaticCopy() {
  document.documentElement.lang = mobileLang;
  document.title = tr('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', tr(el.dataset.i18nAria)));
  document.querySelectorAll('[data-lang-option]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.langOption === mobileLang)));
}

function setMobileLang(lang) {
  mobileLang = lang === 'en' ? 'en' : 'ko';
  const url = new URL(location.href);
  if (mobileLang === 'en') url.searchParams.set('lang', 'en'); else url.searchParams.delete('lang');
  history.replaceState(null, '', url);
  applyStaticCopy();
  window.dispatchEvent(new Event('mobilelangchange'));
}
