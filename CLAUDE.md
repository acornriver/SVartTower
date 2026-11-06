# 청감 타워 (Cochlea Tower) — CLAUDE.md

> 2026 서울시립 북서울미술관 전시 사운드 프로젝트 "모든 귀는 [ ] 이다"의 TV 화면.
> 관람객이 아이패드에서 달팽이를 보내면 실시간으로 미술관 TV에 나타난다.
> 결정권은 원우리 작가에게 있다.

---

## 0. 이 레포와 SVartSoft의 관계

- **검사 앱**은 `SVartSoft` 레포에 있다. 관람객 결과를 Firestore `ears` 컬렉션에 저장한다.
- **이 레포**는 타워 화면만 담는다. Firebase 백엔드 코드는 SVartSoft/cloud/에서 복사해 왔다.
- `cloud/config.js`, `cloud/firebase.js`, `cloud/feed.js`는 **복사본**이다. 이 레포에서 고치지 않는다.
  - 고칠 일이 생기면 "SVartSoft에서 먼저 고치고 → 다시 복사" 순서로 한다.
  - 현재 복사 기준 커밋: `262b339` (SVartSoft)
- `ref/`는 커밋하지 않는다 (`.gitignore`).

## 1. 실행 방법

```bash
# 로컬 서버
python3 -m http.server 8766   # SVartSoft(8765)와 겹치지 않게

# 가짜 데이터 모드 (Firebase 없이 개발)
http://localhost:8766/?mock=1
http://localhost:8766/?mock=1&arrive=15   # 15초마다 가짜 도착

# 로컬 에뮬레이터 (SVartSoft 폴더에서 먼저 에뮬레이터 실행 필요)
http://localhost:8766/?emulator=1
```

에뮬레이터 실행 (SVartSoft 폴더에서):
```bash
PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH firebase emulators:start --only firestore --project svart-test
```

## 2. 키보드 단축키 (설치용)
- `F` : 전체화면 토글
- `R` : 처음부터 (리셋)
- `D` : 디버그 패널 토글

## 3. 피드 API (SVartSoft/cloud/feed.js에서 넘겨받음)

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
| `maxFreqHz` 8000~16000 → 전체 범위 재대응 | 꼬임 촘촘함 |
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

## 6. 작업 규칙 (SVartSoft 8장과 같음)

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
