> 11/22 SVartTower에 반영됨. 지금 구조에서는 `wall/index.html`(전시장 TV, `../variator-*.js`)과 루트 `index.html`(휴대폰, `defer`)에 넣었고, 휴대폰은 `mobile/tower-view.js`에서 `CFG.PART_MESH = 0`(윤곽선만). 아래는 전달받은 설명 그대로입니다. 스크립트는 이 폴더(`tools/variator/`)에 있습니다.

# 청감타워 이스터에그 — 아날로그 다변기 3D 파일 떨어뜨리기

청감타워 바닥에 떨어지는 다변기 부품을, 지금의 '회전체로 흉내 낸 모양'에서 **실제 시행착오 STL 파일 47개의 모양**으로 바꿉니다.
의도: "아날로그 다변기 3D 파일(STL)을 청감 클라우드 바닥에 쓰레기처럼 떨어뜨려 놓음."

## 들어 있는 것

| 파일 | 하는 일 |
| :--- | :--- |
| `variator-parts.js` | STL 47개를 웹용 와이어프레임 데이터로 바꾼 것 (약 410KB). 손으로 고치지 않습니다 |
| `variator-drop.js` | 그 데이터를 타워 바닥에 떨어뜨리고 그리는 코드 |
| `tools/build_parts.py`, `tools/stl_io.py` | STL이 바뀌면 데이터를 다시 만드는 스크립트 |
| `PROMPT.md` | 붙이는 작업을 AI(Codex, Claude 등)에게 맡길 때 쓰는 프롬프트 |

## 붙이는 법 (tower.js는 고치지 않음)

`index.html`에서 `tower.js` **바로 다음에** 두 줄을 넣습니다.

```html
<script src="tower.js"></script>
<script src="variator-parts.js"></script>
<script src="variator-drop.js"></script>
```

모바일 타워(`mobile/index.html`)에도 부품을 보이려면 같은 자리에 `defer`로 넣습니다.

```html
<script defer src="../tower.js"></script>
<script defer src="../variator-parts.js"></script>
<script defer src="../variator-drop.js"></script>
```

`variator-drop.js`는 tower.js의 `addPart / dropPart / updateParts / drawPart`를 **같은 이름으로 다시 정의**합니다.
그래서 처음 바닥에 놓인 부품, 16초마다 자동 낙하, `P` 키, 디버그 창의 '부품 떨어뜨리기'가 모두 그대로 새 모양으로 연결됩니다.
tower.js 안의 예전 부품 코드(`PART_PROFILE` 등)는 남아 있어도 쓰이지 않고, 지워도 됩니다.

## 동작

- 한 번 떨어질 때 **파일 하나**를 무작위로 고르고, 그 파일 안의 조각을 모두 떨어뜨립니다. 가짜 필터 링 4개, 마개 2개처럼 조각이 여러 개면 흩어져 떨어집니다(47개 파일, 56조각).
- 크기는 **실물 비율 그대로**입니다(1mm = 1.6 단위, 타워 높이 600 기준). 3mm 마개처럼 너무 작은 것은 최소 크기로, 120mm 시험 조각판처럼 큰 것은 최대 크기로 맞춥니다.
- 바닥에 놓이는 자세는 각 파일에서 **실제로 놓일 수 있는 면**(나팔을 바닥에 대고 섬, 옆으로 누움 등)을 미리 계산해 그중 하나를 고릅니다. 떨어지는 동안 구르다가 그 자세로 내려앉고, 한두 번 튀며 바닥에 고리가 퍼집니다(예전 동작과 같음).
- 선: 두 면이 8° 이상 꺾이는 모서리만 그립니다. 크게 꺾이는 윤곽선은 밝게(잔광 포함), 나머지 STL 삼각형 결은 옅게 그립니다. 화면에서 아주 작게 보이면 윤곽선만 그립니다.
- 색은 예전과 같은 실버 `[206, 214, 226]`이고, 버려진 물건처럼 가끔 깜빡입니다.

## 조절값

tower.js의 `CFG`에 같은 이름이 있으면 그 값을, 없으면 아래 기본값을 씁니다.

| 이름 | 기본값 | 뜻 |
| :--- | :--- | :--- |
| `PARTS_START` | 5 | 처음부터 바닥에 놓인 파일 수 (tower.js 값) |
| `PART_INTERVAL` | 16 | 몇 초마다 하나씩 떨어지는지, 0이면 자동 낙하 없음 (tower.js 값) |
| `MAX_PARTS` | 18 | 바닥에 남겨 두는 조각 수, 넘으면 오래된 것부터 사라짐 (tower.js 값) |
| `PART_COLOR` | `[206, 214, 226]` | 선 색 (tower.js 값) |
| `PART_MM` | 1.6 | 실물 1mm = 몇 단위 |
| `PART_MIN` / `PART_MAX` | 14 / 90 | 가장 긴 변의 최소·최대 크기 |
| `PART_DETAIL_PX` | 22 | 화면에서 이보다 작으면 윤곽선만 |
| `PART_GLOW` | 0.16 | 윤곽선 잔광 세기 |
| `PART_MESH` | 0.5 | 옅은 삼각형 결 밝기. **느리면 0으로** (윤곽선만) |

## 확인하는 법

- 타워 화면에서 `P` 키 → 무작위 파일 하나가 떨어집니다.
- 브라우저 콘솔: `VariatorDrop.list()` (47개 이름과 번호), `VariatorDrop.drop(번호)` (그 파일 떨어뜨리기), `VariatorDrop.clear()` (바닥 비우기).
- `variator-parts.js`가 빠지면 콘솔에 `[variator] variator-parts.js가 없어…` 경고가 나오고 부품만 안 그려집니다(타워는 그대로 돎).

## 확인한 것과 안 한 것

- **공개 저장소 `acornriver/SVartTower`의 `main`(11/15, `5302aec`) tower.js**에 위 두 줄만 넣고 `?mock=1`로 돌려 확인했습니다. 오류 없음, 바닥·낙하 모양 스크린샷 확인.
- 속도: GPU 없는 헤드리스 크롬(1280×800)에서 부품 0개 16fps → 기본 5파일 14fps → 최대 18조각 약 10fps. 실제 TV용 컴퓨터(GPU)에서는 훨씬 빠를 것으로 보지만 **실기기에서는 확인하지 못했습니다**. 느리면 `PART_MESH: 0` 또는 `MAX_PARTS`를 줄이세요.
- `https://allearsare.love/wall/`의 배포본 코드는 직접 열어 보지 못했습니다. 배포본에서 tower.js의 부품 함수 이름이나 변수 이름이 바뀌었다면 `PROMPT.md`를 AI에게 주면 맞춰 줍니다.

## 데이터 다시 만들기 (STL이 바뀌었을 때)

```bash
pip install numpy scipy
python3 tools/build_parts.py <STL 폴더> variator-parts.js
```

- 원본은 `아날로그다변기_시행착오_3D_1000`(파일당 삼각형 최대 1000개) 판을 썼습니다. 3000개 판은 선이 너무 빽빽해져 실버 덩어리처럼 보여서 쓰지 않았습니다.
- 스크립트 맨 위 `EDGE_DEG`(8°)를 올리면 선이 줄고, 내리면 늘어납니다.
