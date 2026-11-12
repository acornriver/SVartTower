# 청감 타워 — 설치 안내

## 1. GitHub 원격 연결 & Pages 배포

```bash
# 원격 연결 (처음 한 번)
git remote add origin https://github.com/acornriver/SVartTower.git
git push -u origin main
```

GitHub → 레포 Settings → Pages → Source: `main` 브랜치, `/ (root)`  
저장 후 `https://acornriver.github.io/SVartTower/` 에서 접근 가능.

**주의**: `main` 푸시 = GitHub Pages 즉시 반영. 반드시 로컬에서 먼저 확인 후 푸시.

---

## 2. 로컬 개발 실행

```bash
# 타워 폴더에서
python3 -m http.server 8766

# 가짜 데이터 모드
open "http://localhost:8766/?mock=1"

# 가짜 데이터 + 15초마다 도착
open "http://localhost:8766/?mock=1&arrive=15"

# 로컬 에뮬레이터 (SVart 폴더에서 먼저 에뮬레이터 실행)
open "http://localhost:8766/?emulator=1"
```

에뮬레이터 실행 (SVart 폴더에서):
```bash
PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH firebase emulators:start --only firestore --project svart-test
```

---

## 3. Mac Studio 키오스크 설정

### 3-1. 화면 설정
- 해상도: 4K (3840×2160), 주사율 60Hz
- 에너지 절약 → 디스플레이 끄기: **안 함** (Never)
- 화면 보호기: **안 함**

### 3-2. 브라우저 키오스크 모드 (Chrome)
```bash
# 전시 시작 시 실행 (URL은 GitHub Pages 주소로 교체)
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --kiosk \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  "https://acornriver.github.io/SVartTower/"
```

또는 Safari 전체화면: 페이지 열기 → `F` 키로 전체화면 토글.

### 3-3. 키보드 단축키
| 키 | 동작 |
|---|---|
| `F` | 전체화면 토글 |
| `R` | 초기화 (재시작) |
| `D` | 디버그 패널 토글 |

---

## 4. 야간 테스트

```bash
# 30분 메모리·무대 카운트 테스트
open "http://localhost:8766/?mock=1&arrive=3"
```

테스트 체크리스트:
- [ ] 30분 후 무대 마리 수가 ON_STAGE(32) 초과하지 않음
- [ ] 풀(pool) 크기가 500 이하 유지
- [ ] 파티클 개수가 2500 이하 유지 (스크롤 없이 `window._towerDebug.stage.length` 확인)
- [ ] 브라우저 메모리 증가 없음 (Chrome 작업 관리자)
- [ ] fps 60 근처 유지 (D 키로 디버그 패널)

---

## 5. 공통 백엔드 파일 업데이트

원본은 **SVart/cloud/** 입니다. SVart에서 먼저 수정한 뒤 다음 명령으로 동기화합니다.

```bash
# SVart 폴더에서
python3 scripts/sync-tower-cloud.py
python3 scripts/sync-tower-cloud.py --check
```

schema v2 / codeVersion 2 / 실제 가청 한계 8~20kHz를 사용합니다. 규칙·인덱스 배포도 SVart에서 관리합니다. 기존 SVartSoft 복사본 정책은 사용자 지시로 대체했습니다.

## 6. Firebase 환경

Firebase 웹 설정(`cloud/config.js`)은 공개 코드에 포함된다.  
보안은 **App Check (reCAPTCHA Enterprise)** 로 처리한다.  
`cloud/firebase.js`의 `APP_CHECK_SITE_KEY`가 이 레포의 도메인(GitHub Pages URL)에 등록되어 있어야 한다.

Firebase Console → App Check → 웹 앱 → 허용 도메인에 `acornriver.github.io` 추가.

---

## 7. 미확정 항목

전시 전 원우리 작가 확인 필요:
- `STORE_NAMES` / `SHOW_NAMES`: 이름 저장·표시 여부
- `BANNED_WORDS`: 금칙어 목록
- `MOBILE_URL`: QR 코드에 연결할 주소
- `ON_STAGE`: 화면 최대 마리 수 (현재 32)
- `cloud/config.js`의 기타 미확정 항목

모두 `cloud/config.js` 에서 조정한다 (SVart에서 먼저 수정 후 복사).


## 관객용 모바일 QR 연결

관객용 페이지는 같은 GitHub Pages 사이트의 `/mobile/`에 있습니다. SVart의 QR 표시 기능을 연결할 때 SVart의 `CloudConfig.MOBILE_URL`에 `https://acornriver.github.io/SVartTower/mobile/`을 설정하고, 검사 결과를 타워로 보낸 뒤 QR 대상 URL을 만듭니다.

```js
const mobile = new URL(window.CloudConfig.MOBILE_URL);
if (tourState().earId) mobile.searchParams.set('ear', tourState().earId);
mobile.searchParams.set('code', window.EAR_RESULT.code);
// mobile.href를 QR 생성기에 넘깁니다.
```

`ear`에는 Firestore의 문서 ID를 넣습니다. `code`를 함께 보내면 업로드가 진행 중이거나 연결이 끊겼을 때도 코드가 입력되고 근사 EQ로 들을 수 있습니다. Firebase 에뮬레이터는 모바일 주소의 `?emulator=1`로 사용합니다. 로컬 가짜 데이터 모드에서 `?mock=1&code=IWS-RLF%2813.2k%2F6%29`로 코드 자동 입력을 확인할 수 있습니다.

`mobile/audio/`의 세 녹음은 SVart의 `media/audio/`에서 가져왔습니다. 원본이 바뀌면 같은 파일명으로 교체합니다.
