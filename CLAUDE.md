# 청감 타워 (Cochlea Tower) — CLAUDE.md

> 2026 서울시립 북서울미술관 전시 사운드 프로젝트 "모든 귀는 [ ] 이다"의 TV 화면.
> 관람객이 아이패드에서 달팽이를 보내면 실시간으로 미술관 TV에 나타난다.
> 결정권은 원우리 작가에게 있다.

---

## 0. 이 레포와 SVart의 관계 — 2026-11-09 사용자 확정

- **검사 앱과 백엔드 계약의 원본은 `SVart` 레포**입니다. 사용자 지시에 따라 이전 SVartSoft 기준은 더 이상 적용하지 않습니다.
- 현재 payload는 `v:2`, `codeVersion:2`, 청감 코드는 `IWS-RLF(13.2k/6)`입니다. 수신 컬렉션은 같은 Firebase 프로젝트 `svart-tower`의 `ears`입니다.
- `cloud/schema.js`, `config.js`, `firebase.js`, `feed.js`는 SVart/cloud에서 동기화합니다. 수정은 SVart에서 먼저 하고 `python3 scripts/sync-tower-cloud.py`로 복사합니다. `--check`는 차이를 읽기만 합니다.
- `profile.maxFreqHz`는 **8,000~20,000Hz 실제값**입니다. 타워에서 8~16kHz를 늘리는 예전 변환은 제거했습니다. 기존 v1 데이터도 Hz 그대로 그립니다.
- 기존 v1 문서는 계속 읽고, 새로운 전송·쓰기 규칙은 v2를 사용합니다. 개인정보 설정(이름 저장/표시 기본 false)은 유지합니다.
- Firestore 규칙과 인덱스도 SVart가 원본입니다. 현재 로컬 수정이며 실제 프로젝트 배포와 main 푸시는 별도 요청 전까지 하지 않습니다.
- `ref/`는 커밋하지 않습니다.

## 1. 실행 방법

```bash
# 로컬 서버
python3 -m http.server 8766   # SVart(8765)와 겹치지 않게

# 가짜 데이터 모드 (Firebase 없이 개발)
http://localhost:8766/?mock=1
http://localhost:8766/?mock=1&arrive=15   # 15초마다 가짜 도착

# 로컬 에뮬레이터 (SVart 폴더에서 먼저 에뮬레이터 실행 필요)
http://localhost:8766/?emulator=1
```

에뮬레이터 실행 (SVart 폴더에서):
```bash
PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH firebase emulators:start --only firestore --project svart-test
```

## 2. 키보드 단축키와 디버그 창
- `D` : 디버그 창 열기/닫기. 창 안에서 데이터 모드(실제 DB / 테스트 가짜 데이터 / 에뮬레이터, 누르면 주소를 바꿔 다시 엶), 자동 회전, 인식 박스, 주파수 글자를 버튼으로 바꾸고 키 설명을 볼 수 있다. '시험 달팽이 보내기'는 이 화면에만 나오고 DB에 쓰지 않는다.
- `F` 전체화면, `R` 달팽이 비우기, `B` 인식 박스·이름표, `O` 자동 회전, `P` 다변기 부품 떨어뜨리기(스케치의 D를 옮김), 드래그로 타워 돌리기
- 디버그 창이 열려 있을 때 스페이스 = 시험 달팽이 한 마리

## 3. 피드 API (SVart/cloud/feed.js에서 넘겨받음)

```js
window.svartFeed.startFeed({
  onInitial(list),          // 첫 서버 스냅샷 목록
  onArrive(ear, { animate }), // 새 도착 (animate:false면 연출 없이 풀에만)
  onRemove(earId),          // 숨김/제거
  onCount(total)            // 전체 마리 수
});
```

ear 객체 필드:
```
earId, code, codeVersion, profile, name, lang, seat,
createdAt(ms), hidden, app
```

profile 필드: `volDb, lowDb, highDb, register, maxFreqHz, sensitivity, twistAmount, centerDeg, centerImage, dominantEar, earStrength, pitchMode, pitchIndex`  
Part 2 항목은 null일 수 있다.

## 4. 프로필 → 달팽이 변환 (`mapping.js`)

변환 로직은 `mapping.js` 한 곳에만 둔다. 모든 대응에 `// 임시` 주석.

| 실제 데이터 | 비주얼 |
|---|---|
| `volDb` | 몸 크기 |
| `register` LOW/MID/HIGH | 뼈 굵기 |
| `lowDb`, `highDb` | 색, 앉는 잎 |
| `maxFreqHz` 8000~20000 실제값 그대로 | 꼬임 촘촘함 |
| `dominantEar` LEFT/RIGHT | 꼬임 방향 |
| `centerImage` L/C/R → 별/도트/하트 | 점액 모양 |
| `pitchMode` F/B/H → 네모/둥근네모/동그라미 | 껍질 모양 |

## 5. 미확정 목록 (원우리 작가 확인 필요)

config.js의 미확정 항목과 같음:
- `STORE_NAMES` / `SHOW_NAMES`: 이름 저장·표시 (기본 false)
- `BANNED_WORDS`: 금칙어 목록 (기본 비어 있음)
- `MOBILE_URL`: QR 연결 주소
- `EAR_CODE_LETTER_NAMES`: earCode 글자 이름
- `ON_STAGE`: 화면 최대 마리 수 (기본 32, 임시)
- 달팽이 ↔ 타워 비주얼 최종 대응

## 6. 작업 규칙 (SVart 8장과 같음)

- 결정권은 원우리 작가에게 있다. 미확정은 설정값으로 빼 둔다.
- 캐릭터 별칭('말…이')을 화면, 코드, 주석 어디에도 쓰지 않는다.
- 흰 바탕의 귀여운 3D·게임풍으로 돌아가지 않는다.
- 강한 스트로브는 쓰지 않는다.
- `cloud/`는 복사본이므로 이 레포에서 고치지 않는다.
- `ref/`는 커밋하지 않는다.
- main 푸시는 사용자가 확인한 뒤에 한다.

## 7. 진행 기록

### 2026-11-06 — 타워 레포 세우기 & 화면 구현 (Claude)
- SVartTower 레포 세우기: `.gitignore`, `cloud/` 복사본(262b339), `lib/p5.min.js`, CLAUDE.md, SETUP.md
- `index.html`: p5.js 달팽이관 타워 화면. `?mock=1` 가짜 데이터 모드, `?emulator=1` 에뮬레이터 모드
- `mapping.js`: profile → 달팽이 변환 (모두 임시 주석)
- Claude가 임의로 정한 것: ON_STAGE=32, 교체 주기 20초, 카드 순환 7초, 도착 연출 2초 올라오기+3초 커짐, 번인 방지 이동 2분마다 3px

### 2026-11-10 — 실제 비주얼(ref/tower.js) 포트 (Claude, `tower-visual` 브랜치)
- 사용자 지시: `ref/tower.js`가 실제 비주얼이다. 화면을 모두 갈아엎고 거기에 맞춘다. 백엔드(`cloud/`)와 달팽이 모양은 건드리지 않는다. 달팽이는 흰 종이에 붙은 스티커처럼 보여야 한다.
- 파일 구조: `index.html`(껍데기) → `mapping.js` → `snail-sticker.js` → `app.js` → `tower.js`.
  - `tower.js`: `ref/tower.js`의 포트. WEBGL 3D 타워, 종이 배경, 서울 실시간 날씨·시간대, 종이비행기, 필름 그레인. 바꾼 곳은 `포트:` 주석(데모는 `?demo=1`일 때만, `launchSnail`이 달팽이를 돌려줌, `towerReady / towerOverlay / towerKey` 연결, `noTint()` → `tint(255)`).
  - `snail-sticker.js`: 예전 `index.html`의 달팽이 모양 코드(몸·더듬이·껍질)를 그대로 옮기고, 한 장으로 그려 `makeSticker`로 스티커를 만든다. 스티커는 멈춘 그림이라 점액 파티클은 없다.
  - `app.js`: 피드 연결, 무대·풀 관리, 카드, 마리 수, 디버그, 새벽 새로고침.
- 사용자가 고른 것: 스티커 안쪽은 검정 바탕 + 흰 종이 테두리. 남긴 것은 전체 마리 수와 달팽이 소개 카드(QR은 뺌). 실시간 날씨는 tower.js 그대로(open-meteo, 전시장 인터넷 필요).
- 달팽이가 앉는 높이는 tower.js대로 `maxFreqHz`(없으면 14000Hz). 예전의 '저음·고음 → 앉는 잎'은 없어졌다. 볼륨 → 크기는 스티커 크기 배율로 남겼다.
- Claude가 정한 임시값: 무대 최대 60(`CFG.MAX_SNAILS`, tower.js 값), 스티커 크기 배율 0.8~1.2, 카드는 왼쪽 아래 흰 종이 카드, 도착 카드 고정 14초, 스티커 만들기 60ms 간격.
- 주의: 스티커는 draw 밖(타이머)에서 만든다. p5 1.9.4 WEBGL에서 `noTint()` 뒤 그리기가 오류로 멈춰 `tint(255)`로 바꿨다(원본 ref도 같은 오류가 남).
- 확인: `?mock=1&arrive=15`로 타워, 스티커, 종이비행기 도착, 카드, 마리 수가 나오고 약 58fps. 실제 Firebase 피드와 TV 실기기는 미확인. 커밋 전.
- 11/10 추가(사용자 요청): 그레인 0.16 → 0.07, 무늬 바꾸는 간격 2 → 4프레임. 밤 하늘·조명·스티커 밝기를 올림(`computeLook`, 원본 값은 `포트:` 주석). 디버그 창에 버튼과 키 설명, 데이터 모드 전환을 넣음. 값은 모두 Claude가 정함.

### 2026-11-12 — 네온 버전(ref/sketch (14).js)으로 비주얼 교체 (Claude, `tower-visual` 브랜치)
- 사용자 지시: 백엔드 로직은 그대로 두고 모든 비주얼을 `ref/sketch (14).js`에 맞춘다. 11/10의 3D 종이 타워(`ref/tower.js` 포트)는 이 버전으로 대체됐다.
- `tower.js`: `ref/sketch (14).js`의 포트. 검은 배경, 네온 기둥과 잎사귀 둘레길, 포탈 접속, 인식 박스와 청감 코드 이름표, 다변기 부품 이스터에그. 캔버스 2D만 쓴다(WEBGL 아님). 바꾼 곳은 `포트:` 주석(데모는 `?demo=1`일 때만, `towerReady / towerOverlay / towerKey` 연결, 부품 키 D → P).
- `snail-sticker.js`: 달팽이 모양 코드는 그대로. `makeSnailImage`가 검은 바탕 그림을 만들고 여백을 잘라 낸다. tower.js가 `screen`으로 합성해 선만 빛난다. 흰 종이 스티커는 없앴다.
- `app.js`: 피드 → `addSnail(hz, img, earId, 포탈 여부)`. 이름표는 `ear.code`. 소개 카드, 마리 수 글자, 번인 이동, 날씨·시간대 버튼은 없앴다.
- 사용자가 고른 것: 달팽이는 스케치대로 빛나는 선, 소개 카드와 마리 수는 둘 다 뺌, 다변기 부품은 그대로 넣음.
- Claude가 정한 것: 부품 키를 P로 옮김, 무대 최대 40(스케치 값), 볼륨 → 크기 0.8~1.2배 유지. 달팽이 선 색은 우리 모양 그대로(⑥ 중앙 색)이고 잎·포탈·발밑 빛은 스케치대로 높이 색이다.
- 확인: `?mock=1&arrive=15`에서 타워, 달팽이, 포탈 접속, 이름표, 부품, 디버그 창이 나오고 약 57~60fps, 오류 없음. 실제 Firebase 피드와 TV 실기기는 미확인.
