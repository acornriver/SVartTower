# 청감 타워 · SVartTower

**[GitHub Pages에서 청감 타워 열기](https://acornriver.github.io/SVartTower/)**

2026 서울시립 북서울미술관 전시 사운드 프로젝트 《모든 귀는 [ ] 이다》의 전시장 TV 화면입니다. 관람객이 아이패드의 [SVart](https://github.com/acornriver/SVart)에서 청감 검사를 마치고 달팽이를 보내면, 타워에 실시간으로 나타납니다.

SVart 결과 화면의 몸체, 껍질, 더듬이와 움직이는 점액을 타워에서도 볼 수 있습니다. 달팽이는 검사에서 측정한 고역 한계가 정한 높이 주변에 퍼져 도착합니다. 같은 고역 한계라도 달팽이마다 둘레길의 다른 위치에 자리 잡을 수 있습니다.

## 로컬에서 실행

저장소 폴더에서 실행합니다.

```bash
python3 -m http.server 8766
```

| 모드 | 주소 |
| --- | --- |
| 가짜 데이터 | [localhost:8766/?mock=1](http://localhost:8766/?mock=1) |
| 가짜 데이터와 15초마다 새 달팽이 도착 | [localhost:8766/?mock=1&arrive=15](http://localhost:8766/?mock=1&arrive=15) |
| 실제 Firebase 피드 | [localhost:8766](http://localhost:8766/) |

## 관객용 모바일

[관객용 청감 타워](https://acornriver.github.io/SVartTower/mobile/) · [로컬 가짜 데이터 모드](http://localhost:8766/mobile/?mock=1)

`IWS-RLF`처럼 영문만 입력해 달팽이를 그려보고, 다른 달팽이를 선택해 세 사운드스케이프에서 **내 EQ**와 **이 달팽이 EQ**를 전환할 수 있습니다. 코드로는 근사 EQ를 만들고, QR의 검사 기록을 불러오면 저장된 EQ 값을 적용합니다. 비교 재생은 검사 당시의 개인별 음량 대신 공통 음량 기준을 사용합니다.

## 화면 조작

| 조작 | 기능 |
| --- | --- |
| `D` | 디버그 패널 열기·닫기. **달팽이** 목록에서 선택하면 움직이는 달팽이를 크게 볼 수 있습니다. |
| `F` | 전체화면 전환 |
| `B` | 인식 박스와 청감 코드 표시 전환 |
| `O` | 자동 회전 전환 |
| 드래그 | 타워 돌리기 |
| 스페이스 | 디버그 패널이 열린 상태에서 화면에만 시험 달팽이 추가 |

Firebase 에뮬레이터와 GitHub Pages 배포 설정은 [설치 안내](SETUP.md)에 있습니다.
