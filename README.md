# BEAT//SHIFT

**RHYTHM IS EVERYTHING.** 브라우저에서 바로 플레이하는 4레인 리듬게임입니다.
키보드(D F J K)와 모바일 터치를 모두 지원하고, 음악·노트·판정·콤보·FEVER·결과 화면이 하나의 흐름으로 이어집니다.

- 오리지널 곡 9개 × 난이도 3개(EASY / NORMAL / HARD), 차트 27개
- 모든 음악과 효과음은 코드로 작곡하고 브라우저에서 합성합니다. 외부 음원·샘플 파일이 전혀 없어 저작권 문제가 없습니다.

## 수록곡

| # | 곡 | 장르 | BPM | 길이 | 레벨 (E / N / H) | 배경 |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | MIDNIGHT DRIVE | Synthwave | 124 | 1:21 | 2 / 5 / 8 | 신스웨이브 하이웨이 |
| 02 | DIGITAL RAIN | Cyber Breaks | 148 | 1:15 | 3 / 6 / 9 | 디지털 레인 |
| 03 | NEON RUSH | Hyper DnB | 172 | 1:29 | 4 / 7 / 11 | 네온 터널 |
| 04 | LOFI MOONRISE | Chill Beat | 88 | 1:33 | 1 / 3 / 6 | 별빛 워프 |
| 05 | STARLIGHT PARADE | Future Funk | 112 | 1:30 | 2 / 5 / 8 | 별빛 워프 |
| 06 | OCEAN CIRCUIT | Progressive House | 128 | 1:19 | 3 / 5 / 9 | 빛의 물결 |
| 07 | GLITCH GARDEN | Chiptune Breaks | 140 | 1:12 | 3 / 6 / 10 | 디지털 레인 (보라) |
| 08 | CRIMSON PULSE | Hard Electro | 160 | 1:36 | 4 / 7 / 11 | 네온 터널 (적색) |
| 09 | SOLAR FLARE | Hyper Trance | 180 | 1:36 | 5 / 8 / 12 | 하이웨이 (태양) |

리드 음색은 곡마다 슈퍼소우(supersaw) · 칩튠 펄스(pulse) · FM 벨(bell) 중에서 고르고, 킥 디스토션·하이햇 레벨·사이드체인 양으로 장르 느낌을 냅니다. 곡 간 음량은 마스터 단계에서 맞춥니다.
- 서버 없이 동작합니다. 기록은 브라우저 `localStorage`에만 저장됩니다.

## 실행

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # tsc -b + vite build → dist/
npm run preview      # 빌드 결과 미리보기
npm run lint         # ESLint
npm run typecheck    # TypeScript (strict)
npm test             # 단위 테스트 + 차트 싱크 검사 (vitest)
npm run check:charts # 차트 파서 경고를 줄 번호와 함께 출력
npm run generate:charts # @generated 표시가 있는 차트를 작곡 데이터에서 다시 생성
```

## 조작

| 동작 | 키보드 | 모바일 |
| --- | --- | --- |
| 레인 1–4 | `D` `F` `J` `K` (설정에서 변경 가능) | 화면 하단 4개 레인 터치 (바깥 레인은 화면 끝까지 판정 영역) |
| 일시정지 / 재개 | `ESC` 또는 `P` | 우측 상단 ❚❚ |
| 메뉴 이동 | `↑` `↓` `←` `→` `Enter` `ESC` | 탭 |

곡 선택 화면에서 `↑↓`는 곡, `←→`는 난이도, `[` `]`(또는 `-` `=`)는 노트 속도, `Enter`는 시작입니다.

## 처음 하는 사람을 위한 흐름

- 첫 곡을 시작하기 전에 **HOW TO PLAY** 카드가 한 번 나옵니다. 터치 기기는 "레인을 탭", 키보드는 설정된 키를 보여 주고, HOLD·RELEASE·ROLL·DOUBLE·FEVER·일시정지를 설명합니다. 설정 › HELP에서 다시 볼 수 있습니다. 카드에는 버전이 있어서, 새 노트 타입이 추가되면 이미 본 사람에게도 한 번 더 나옵니다.
- 첫 추천 난이도는 **EASY**입니다. 타이틀의 PLAY는 마지막으로 고른 곡·난이도로 바로 시작합니다.
- 터치 기기에서는 카운트다운 동안 판정선 아래에 "TAP"이 깜빡입니다. 키보드 라벨은 화면 크기가 아니라 입력 장치 기준으로 표시합니다.
- 타이틀에서 시작하는 순간 마지막 곡을 미리 합성해 PLAY가 바로 시작되고, 처음 여는 곡은 로딩 화면에 진행률이 표시됩니다.
- 데스크톱에서 다른 창으로 전환하면 자동으로 일시정지합니다.

## 싱크(오디오 지연) 맞추기

블루투스 이어폰처럼 소리가 늦게 들리는 환경에서는 계속 늦게 치게 됩니다.

- **결과 화면 타이밍 분석**: 입력 오차 분포 그래프와 평균(빠름/늦음)을 보여 줍니다. 20번 이상 입력했고 평균이 25ms 이상 치우쳐 있으면 **FIX SYNC** 버튼으로 보정값을 한 번에 적용합니다. (시뮬레이션: 110ms 늦게 치는 플레이어 31% → 적용 후 재도전 94%)
- **설정 › CALIBRATE BY TAPPING**: 100 BPM 메트로놈에 맞춰 16번 탭하면 실제 출력 시각 기준 오차의 중앙값으로 보정값을 제안합니다.
- 보정 범위는 ±300ms입니다.

## 게임 시스템

| 항목 | 내용 | 설정 위치 |
| --- | --- | --- |
| 판정 | PERFECT ±45ms · GREAT ±90ms · GOOD ±135ms · MISS ±180ms | `src/game/config/judgment.ts` |
| 정확도 | PERFECT 100% · GREAT 75% · GOOD 40% · MISS 0% | `src/game/config/scoring.ts` |
| 점수 | 기본 1,000,000점 배분 × 판정 가중치 × 콤보 배율(25/50/100/200) × FEVER ×1.5 + 노트 타입 보너스 + 롱노트 틱 | `src/game/config/scoring.ts` |
| FEVER | 좋은 판정으로 게이지 충전 → 가득 차면 32박 동안 발동. 게이지 크기는 차트별로 계산되어, 클린 플레이 기준 첫 **DROP** 첫 노트에서 발동합니다. | `src/game/config/fever.ts` |
| 랭크 | 정확도 70% + 이론 최대 점수 대비 비율 30%. S+는 풀콤보 필요 | `src/game/config/rank.ts` |
| 콤보 연출 | 25 glow · 50 강화 · 100 특수 애니메이션 · 200 최대 연출 | `src/game/config/combo.ts` |

### 화면 배치 (노트를 가리지 않기)

- 노트가 내려오는 길 위에는 아무것도 그리지 않습니다. 판정선 플래시·FEVER 색조는 노트 **아래**(배경 층)에 그려지고, 노트는 이펙트 위에 그려집니다.
- 넓은 화면: 콤보·판정 배너는 하이웨이 **왼쪽 열**에 표시됩니다.
- 좁은 화면(휴대폰): 콤보와 판정은 **판정선 아래** 영역에, 상단 HUD 아래부터 하이웨이가 시작됩니다.
- 판정 텍스트, COMBO 100 / FEVER 배너 모두 같은 규칙을 따릅니다.

노트 타입:

| 타입 | 조작 | 모양 |
| --- | --- | --- |
| **TAP** | 판정선에서 탭 | 기본 노트 |
| **HOLD** | 머리에서 누르고 꼬리까지 유지. 중간에 떼면 짧은 유예 후 HOLD BREAK | 레인 색 몸통 |
| **RELEASE** | 머리에서 누르고, **꼬리에서 정확히 뗌**. 떼는 타이밍이 탭처럼 PERFECT~MISS로 판정되고, 너무 오래 쥐고 있으면 GOOD | 민트색 점선 테두리 + 꼬리 위 ▲ |
| **ROLL** | 구간 동안 **연타**. 목표 타수(박당 2타) 대비 100% PERFECT · 70% GREAT · 40% GOOD. 타격마다 점수가 들어가고 목표의 1.5배까지 보너스 | 주황 사선 줄무늬 + 남은 타수 카운터 |
| **DOUBLE** | 동시 입력 | 연결선 |
| **RAPID** | 짧은 간격 연타 | |
| **BURST** | `burst` 구간의 고밀도 노트 | |

HOLD와 RELEASE는 머리와 꼬리가 각각 판정 1개로 계산됩니다 (콤보·정확도·FEVER 게이지).
타입은 `src/game/config/noteTypes.ts` 레지스트리로 관리되어 새 타입을 추가하기 쉽습니다.

## 타이밍 엔진

- 게임 시간은 React 렌더링이 아니라 **AudioContext 시계**를 기준으로 합니다. `getOutputTimestamp()`(미지원 시 `outputLatency`)로 실제 스피커 출력 시점을 추정하고, `performance.now()`로 보간해 프레임마다 부드럽게 움직입니다 (`GameClock.ts`).
- 음악은 `AudioBufferSourceNode.start(when, offset)`로 샘플 단위 예약 재생되고, 카운트다운 틱과 GO도 같은 시계에 예약됩니다. 카운트다운의 GO가 정확히 음악의 0박입니다.
- 입력은 이벤트의 `timeStamp`로 보정한 시각에 판정합니다.
- 노트 이동·이펙트는 `requestAnimationFrame` + Canvas 2D로 그리며, 매 프레임 React 상태 갱신이 없습니다. HUD(점수·콤보·판정)는 DOM을 직접 갱신하고 Web Animations API로 연출합니다.
- 설정의 **AUDIO OFFSET**으로 기기별 지연(블루투스 이어폰 등)을 보정할 수 있습니다.

## 구조

```
src/
  game/
    types.ts                 도메인 타입 (Song, Chart, Note, PlayResult …)
    config/                  판정·점수·FEVER·랭크·콤보·난이도·노트 타입 (밸런스 조정은 여기서만)
    chart/chartParser.ts     텍스트 차트 → 시간 기준 노트 (검증/경고 포함)
    chart/chartGenerator.ts  작곡 데이터 → 텍스트 차트 자동 생성
    songs/                   곡 정의(작곡 데이터 + 테마) 와 charts/*.chart
    engine/
      GameEngine.ts          오케스트레이터: 루프, 페이즈, 일시정지, 디버그 도구
      GameClock.ts           오디오 기준 게임 시계
      InputManager.ts        키보드 / 터치 / 마우스 → 레인 press/release
      JudgmentSystem.ts      노트 상태, 판정, 홀드 유지/브레이크
      ScoreSystem.ts         점수, 콤보, 정확도, FEVER, 이론 최대 점수
    render/                  Canvas 렌더러: 원근 하이웨이, 노트 스프라이트, 파티클 풀, 배경 5종(테마 색 적용)
    audio/
      AudioManager.ts        AudioContext, MASTER/MUSIC/SFX 버스, 곡 캐시, 미리듣기
      synth/                 오프라인 DSP 신스(악기·리버브·딜레이·사이드체인)와 효과음
      songRender.worker.ts   곡 렌더링을 Web Worker에서 실행
  storage/                   localStorage 래퍼 + 설정/기록 검증
  ui/                        화면(React), HUD, 일시정지, 디버그 패널
```

엔진은 `GamePresenter` 인터페이스로 렌더러·HUD·사운드에 이벤트를 전달합니다. 로직과 표현이 분리되어 있어 연출을 바꿔도 판정 코드는 건드리지 않습니다.

## 차트 포맷

차트는 사람이 직접 고칠 수 있는 텍스트 파일입니다 (`src/game/songs/charts/*.chart`).

```text
# 주석
@offset 0.02                # (선택) 모든 노트에 더할 초
[drop burst]                # 구간 표시 + 플래그 (burst → BURST 노트)
$A = 03 . . 1 2 . 3 . 2 . 1 . 0~3 . 3 .   # 매크로 정의 (';'로 여러 마디)
$A x2                       # 매크로 2번 재생
0 . 1 . 2 . 3 . | x4        # 한 마디를 4번 반복
- x2                        # 빈 마디 2개
```

- 한 줄 = 4/4 한 마디. 토큰 개수가 해상도를 정합니다 (4 = 4분음표, 8 = 8분, 16 = 16분, 12 = 셋잇단).
- `.` 쉼표 · `2` 2번 레인 탭 · `03` 0·3번 동시(DOUBLE) · `1~8` 1번 레인 HOLD(현재 해상도로 8스텝) · `1^8` RELEASE · `1*8` ROLL · `0+3~4` 탭과 홀드 동시
- 파서는 잘못된 토큰, 레인 범위, 겹치는 노트, 홀드 끝 직후 같은 레인 노트(0.25박 미만)를 줄 번호와 함께 보고하고, 가능한 부분은 계속 읽습니다.
- `npm test`의 **싱크 검사**는 모든 노트가 실제 음악의 발음 시점(킥·스네어·하이햇·베이스·리드·아르페지오)에 놓였는지 확인합니다.

### 차트 자동 생성

`npm run generate:charts`는 곡의 작곡 데이터(리드 멜로디·킥·스네어·아르페지오·스네어 롤)를 읽어 EASY/NORMAL/HARD 차트를 만듭니다 (`src/game/chart/chartGenerator.ts`).

- 난이도별로 사용할 박자 격자, 최소 간격, 마디당 노트 수(BPM과 구간 에너지로 조절), 롱노트 기준, 동시치기 위치를 정합니다.
- 레인은 멜로디 음높이의 흐름을 따르고, 같은 레인 연타와 홀드 중인 레인은 피합니다.
- 두 번째 DROP은 `burst` 구간이 되어 HARD에서 16분 연타가 나옵니다.
- 긴 리드 음은 HOLD가 되고, 난이도별로 몇 개마다 하나(EASY 4 · NORMAL 3 · HARD 2)는 RELEASE가 됩니다. NORMAL 이상은 베이스 지속음, 잔잔한 구간은 패드 화음에도 HOLD를 둡니다.
- 스네어 롤이 있는 빌드업(`roll` 구간)의 마지막 마디는 ROLL이 됩니다.
- 결과는 일반 차트 파일로 저장되어 손으로 고칠 수 있습니다. 파일의 `# @generated` 줄이 남아 있는 차트만 다시 생성되며, 그 줄을 지우면 수정한 내용이 보존됩니다. MIDNIGHT DRIVE · DIGITAL RAIN · NEON RUSH는 손으로 만든 차트입니다.

### 곡 추가하기

1. `src/game/songs/`에 `SongDefinition`을 만듭니다: BPM, 테마(레인 색·배경 스타일·`sky` 팔레트), `composition`(구간별 드럼 패턴·코드·베이스·리드·음색), 난이도별 차트 import. 공용 드럼 패턴은 `songs/patterns.ts`에 있습니다.
2. `charts/<id>.<difficulty>.chart` 파일을 `# @generated` 한 줄로 만들고 `npm run generate:charts`를 실행하거나, 직접 작성합니다. 차트의 `[구간]` 이름과 길이는 `composition.sections`와 맞아야 합니다 (테스트가 검사합니다).
3. `src/game/songs/index.ts`의 `SONGS`에 추가하고 `npm test`로 싱크·패턴 길이·FEVER 위치를 확인합니다. 난이도는 `src/game/config/difficulty.ts`에 정의된 것 중 차트가 있는 것만 표시됩니다 (EXPERT 슬롯 준비됨).

## 디버그 모드

개발 서버(`npm run dev`)에서 `?debug=true`를 붙이면 디버그 패널이 나타납니다. 프로덕션 빌드에서는 숨겨집니다 (`VITE_ENABLE_DEBUG=true`로 빌드하면 활성화).

- 표시: 곡/난이도, 페이즈, 현재 시간·박, BPM·구간, 콤보, 점수(이론 최대 대비), 정확도, 판정 수, FEVER, 노트 인덱스, 오디오 동기 상태
- 버튼: Restart · Skip 10 sec · Trigger Fever · Spawn Test Note · Perfect Test · Miss Test · Finish Song · Reset Records · Autoplay
- `&autoplay=true`: 모든 플레이를 오토플레이로 시작 (기록 저장 안 함, HUD에 AUTO 표시)
- `&panel=false`: 디버그 기능은 유지하고 패널만 숨김 (깔끔한 화면 녹화용)

## 릴스 촬영 가이드 (9:16)

추천: 휴대폰 세로 화면 또는 브라우저 개발자 도구의 모바일 뷰(390×844), **NEON RUSH / HARD** 또는 **MIDNIGHT DRIVE / HARD**, NOTE SPEED 2×, 우측 상단 전체화면.

한 번의 플레이에서 다음 장면이 순서대로 나옵니다.

1. **COUNTDOWN** – READY → 3 → 2 → 1 → GO (GO = 음악 0박)
2. **초반 노트** – 인트로/벌스의 아르페지오 패턴
3. **연속 PERFECT** – 판정선 글로우가 PERFECT 연속에 따라 강해짐
4. **ROLL** – 빌드업 마지막 마디의 스네어 롤을 연타
5. **COMBO 100** – 배너 + 충격파 + 무지개 콤보 숫자 (노트 길 밖에 표시)
6. **FEVER** – 첫 DROP에서 발동: 배경 가속, 레인 무지개, 파티클 증가, ×1.5
7. **노트 폭주** – DROP 2의 BURST 구간
8. **최종 판정** – FULL COMBO / ALL PERFECT 배너
9. **결과** – 랭크 등장, 정확도·점수 카운트업, NEW RECORD

직접 플레이가 어렵다면 개발 서버에서 `?debug=true&autoplay=true&panel=false`로 같은 장면을 녹화할 수 있습니다 (결과 화면에 AUTO PLAY 표시).

## 접근성

- 모든 메뉴 키보드 조작, 포커스 표시, 버튼/라디오/대화상자 ARIA
- REDUCED MOTION (시스템 설정 자동 반영): 흔들림·플래시·카메라 이동 제거
- 사운드를 꺼도 시각 피드백만으로 플레이 가능. Web Audio를 쓸 수 없는 환경에서는 무음 모드(성능 시계)로 자동 전환

## 오류 처리

오디오 렌더링 실패(→ 메인 스레드 재시도 → 무음 모드), 알 수 없는 곡/깨진 차트(→ 오류 화면), `localStorage` 차단·손상(→ 기본값, 손상 항목만 폐기), 탭 전환(→ 자동 일시정지), 렌더링 예외(→ ErrorBoundary 복구 화면)를 처리합니다.
