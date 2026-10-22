# Drone Chase Scoring 2026

드론 추격전(Orbital Pursuit 2026) 대회용 **심판 채점(Judge Panel) + 본부 순위표(HQ Dashboard)** 웹앱입니다.
React + Vite + Tailwind CSS + Firebase Realtime Database(실시간 동기화)로 만들었습니다.

- 심판: 태블릿·휴대폰에서 참가번호, 장애물 통과, 착륙 입력 + **내장 초시계**로 랩타임 측정 → 제출
- 본부: 모든 기기의 제출 기록이 실시간으로 순위표에 반영, 수정·삭제·CSV 저장
- idrcc-scoring 과 같은 Firebase 프로젝트를 쓰되, 저장 위치(`drone_chase_2026`)가 달라 IDRCC 기록과 섞이지 않음

---

## 1. 처음 한 번만: 내 컴퓨터에 준비하기

1. **Node.js LTS** 설치: <https://nodejs.org> (설치 후 VS Code 재시작)
2. VS Code → `Ctrl+Shift+P` → **Git: Clone** → 이 저장소 주소 입력 → 저장할 폴더 선택 → **Open**
3. VS Code 메뉴 **터미널 → 새 터미널** 에서:

```bash
npm install
```


## 2. 실행하기 (수정하면서 바로 확인)

```bash
npm run dev
```

터미널에 나오는 `http://localhost:5173` 을 브라우저로 엽니다. 파일을 저장하면 화면이 **자동으로 새로고침**됩니다.
같은 와이파이의 태블릿에서는 터미널에 함께 표시되는 `Network: http://192.168.x.x:5173` 주소로 접속할 수 있습니다.

종료: 터미널에서 `Ctrl + C`

## 3. Firebase 연결

이미 연결되어 있습니다. 연결 정보는 `src/firebaseConfig.js` 에 있습니다.

- 프로젝트: `idrcc-d9cb5` (IDRCC 채점 앱과 같은 프로젝트) → **Realtime Database**
- 저장 위치: `drone_chase_2026` (`src/config.js` 의 `DB_PATH`)
- 화면 오른쪽 위에 초록색 **Live** 가 보이면 정상 연결입니다.

**"데이터베이스에 접근할 수 없습니다"(빨간 띠)가 보이면** 보안 규칙에서 새 저장 위치를 허용해야 합니다.

1. <https://console.firebase.google.com> → `idrcc-d9cb5` → 왼쪽 **Realtime Database** → **규칙(Rules)** 탭
2. 기존 규칙은 **지우지 말고**, `"rules": { ... }` 안에 아래 블록을 추가한 뒤 **게시**

```json
"drone_chase_2026": {
  ".read": true,
  ".write": true
},
```

(전체 예시는 `database.rules.json` 참고. 기존 IDRCC 규칙(`scores` 등)은 그대로 두세요.)

다른 Firebase 프로젝트를 쓰려면 `src/firebaseConfig.js` 의 값만 바꾸면 됩니다.

## 학생 서명

- Judge Panel 5번 **Signature · 학생 서명** 칸에 학생이 손가락(또는 펜·마우스)으로 서명합니다. **서명이 없으면 제출되지 않습니다.**
- 서명은 점수 기록과 함께 Firebase에 저장되고, HQ Dashboard의 **Signature** 칸에서 작게 보이며 누르면 크게 볼 수 있습니다.
- HQ에서 점수를 수정해도 서명은 그대로 유지됩니다. CSV에는 서명 여부(Y/N)만 표시됩니다.
- 서명 패드 코드는 `src/SignatureBox.jsx` 에 있습니다 (idrcc-scoring 과 같은 라이브러리 `react-signature-canvas`).

## 초시계 사용법

- 채점 화면 하단 고정 바의 **START → STOP**. STOP을 누르면 랩타임 칸에 초 단위(소수 둘째 자리)로 자동 입력됩니다.
- **Undo**: 실수로 멈췄을 때 처음 시작 시각부터 이어서 측정 · **Reset**: 초시계만 0으로 (랩타임 칸 값은 유지)
- 측정 중에는 제출 버튼이 잠깁니다. 제출이 끝나면 다음 참가자를 위해 초시계가 자동 초기화됩니다.
- 시작 시각 기준으로 계산하므로 화면 꺼짐·탭 전환·새로고침에도 정확하며, 측정 중에는 화면 꺼짐을 막습니다(지원 기기).
- PC에서는 **스페이스바**로 시작/정지할 수 있습니다(입력 칸에 커서가 있을 때는 동작 안 함).
- 초시계 코드는 `src/useStopwatch.js` 에 있습니다 (idrcc-scoring 과 같은 방식).

## 4. 자주 고치는 곳 — `src/config.js`

| 고칠 내용 | 항목 |
|---|---|
| 대회 이름·부제·행사명 | `COMPETITION` |
| 접속 코드 (모든 사용자) | `ADMIN_PASSWORD` |
| HQ Dashboard 비밀번호 (본부 전용) | `HQ_PASSWORD` |
| 기록 저장 위치(대회마다 다르게) | `DB_PATH` |
| 장애물 개수·이름·점수 | `OBSTACLES`, `POINTS_PER_OBSTACLE` |
| 착륙 점수 선택지 | `LANDING_OPTIONS` |
| 랩타임 구간별 점수 | `TIME_BRACKETS`, `TIME_POINTS_INCOMPLETE` |

만점(Total)은 위 값에서 **자동 계산**됩니다. 화면 디자인은 `src/App.jsx` 에 있습니다.

> `DB_PATH` 를 바꾸면 Firebase 보안 규칙의 `drone_chase_2026` 부분도 같은 이름으로 바꿔야 합니다. IDRCC 앱이 쓰는 `scores`, `signatures` 는 쓰지 마세요.

## 5. GitHub에 저장하기 (수정 후)

VS Code 왼쪽 **소스 제어(가지 모양 아이콘)** → 변경 내용 메시지 입력 → **커밋** → **동기화(Sync/Push)**.

## 6. 웹에 배포하기 (GitHub Pages, 무료)

1. 저장소 **Settings → Pages → Source: GitHub Actions**
2. `main` 에 push 하면 자동 배포 → `https://<계정>.github.io/drone-chase-scoring/`

(Netlify를 쓰는 경우: Build command `npm run build`, Publish directory `dist`)

## 7. 보안 안내

- 접속 코드는 **화면 잠금** 용도입니다. 코드가 웹페이지 소스에 포함되므로 진짜 보안 장치는 아닙니다.
- 웹용 Firebase 키는 원래 공개되는 값이라 코드에 그대로 둡니다. 실제 데이터 보호는 **Firebase 보안 규칙**이 담당합니다.
- 지금 규칙은 주소를 아는 누구나 읽고 쓸 수 있는 상태입니다(IDRCC 앱과 동일). 대회가 끝나면 규칙에서 `".write": false` 로 바꿔 두세요.
- 더 엄격히 하려면 Firebase Authentication(익명 로그인 또는 심판 계정)을 추가하고 규칙에서 `auth != null` 을 요구하는 방식을 권장합니다.

## 원본 코드 대비 수정 사항

| # | 문제 | 수정 |
|---|---|---|
| 1 | 전송 실패해도 "Sync Complete" 화면이 표시되어 기록 누락을 알 수 없음 | 저장 성공 시에만 완료 화면, 실패 시 입력값 유지 + 오류 안내 |
| 2 | 제출 버튼 연타 시 중복 저장 가능 | 저장 중 버튼 비활성화 |
| 3 | 전체 삭제(`forEach(async)`)가 완료를 기다리지 않고 오류도 잡지 못함 | 저장 위치 한 번에 삭제 + `RESET` 입력 2단계 확인 |
| 4 | 수정 모달이 state를 직접 변경, `obstacles` 없는 기록에서 오류, 수정 중 삭제되면 화면 오류 | 정규화한 복사본 사용, 삭제 시 모달 자동 닫힘 |
| 5 | 수정 시 문서에 `id` 필드까지 저장됨 | 저장 필드만 골라서 저장 |
| 6 | 정렬 비교 함수가 둘 다 DNF일 때 일관되지 않음 | 총점 → 랩타임 → 제출순, 동점자 같은 순위 |
| 7 | CSV에서 이름에 쉼표가 있으면 칸이 밀리고, `#` 문자에서 잘림 | CSV 이스케이프 + Blob 방식 저장 |
| 8 | 수정/삭제 버튼이 마우스 hover 에서만 보여 **태블릿에서 사용 불가** | 항상 표시 |
| 9 | `animate-fade-in` 클래스가 Tailwind에 정의되어 있지 않음 | `tailwind.config.js` 에 정의 |
| 10 | 인터넷이 끊긴 상태에서 제출하면 기기에 쌓였다가 나중에 전송되어 중복 위험 | 연결 끊김 시 제출 차단 + 화면에 Offline 표시 |
| 11 | 점수 입력 검증 없음(음수 랩타임 등) | 입력 검증 추가 |
| 12 | 배점이 코드 곳곳에 흩어져 있어 수정 어려움 | `src/config.js` 한 곳으로 모음 |
