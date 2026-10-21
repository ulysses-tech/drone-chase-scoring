# Drone Chase Scoring 2026

드론 추격전(Orbital Pursuit 2026) 대회용 **심판 채점(Judge Panel) + 본부 순위표(HQ Dashboard)** 웹앱입니다.
React + Vite + Tailwind CSS + Firebase Firestore(실시간 동기화)로 만들었습니다.

- 심판: 태블릿·휴대폰에서 참가번호, 장애물 통과, 착륙, 랩타임 입력 → 제출
- 본부: 모든 기기의 제출 기록이 실시간으로 순위표에 반영, 수정·삭제·CSV 저장
- Firebase 설정이 없으면 **데모 모드**(이 기기 브라우저에만 저장)로 동작 → 설정 전에도 화면 확인 가능

---

## 1. 처음 한 번만: 내 컴퓨터에 준비하기

1. **Node.js LTS** 설치: <https://nodejs.org> (설치 후 VS Code 재시작)
2. VS Code → `Ctrl+Shift+P` → **Git: Clone** → 이 저장소 주소 입력 → 저장할 폴더 선택 → **Open**
3. VS Code 메뉴 **터미널 → 새 터미널** 에서:

```bash
npm install
```

4. `.env.example` 파일을 복사해 이름을 `.env` 로 바꾸고 Firebase 값을 채웁니다 (아래 3번 참고).

## 2. 실행하기 (수정하면서 바로 확인)

```bash
npm run dev
```

터미널에 나오는 `http://localhost:5173` 을 브라우저로 엽니다. 파일을 저장하면 화면이 **자동으로 새로고침**됩니다.
같은 와이파이의 태블릿에서는 터미널에 함께 표시되는 `Network: http://192.168.x.x:5173` 주소로 접속할 수 있습니다.

종료: 터미널에서 `Ctrl + C`

## 3. Firebase 연결

1. <https://console.firebase.google.com> → 프로젝트 만들기
2. **Firestore Database** 만들기 (위치: `asia-northeast3` 서울 권장)
3. 프로젝트 설정 → 일반 → **웹 앱 추가(</>)** → 표시되는 `firebaseConfig` 값을 `.env` 에 옮겨 적기
4. Firestore → **규칙(Rules)** 탭에 `firestore.rules` 내용을 붙여넣고 게시 (날짜는 대회 일정에 맞게)

## 4. 자주 고치는 곳 — `src/config.js`

| 고칠 내용 | 항목 |
|---|---|
| 대회 이름·부제·행사명 | `COMPETITION` |
| 접속 코드 | `ADMIN_PASSWORD` |
| 기록 저장 위치(대회마다 다르게) | `COLLECTION_NAME` |
| 장애물 개수·이름·점수 | `OBSTACLES`, `POINTS_PER_OBSTACLE` |
| 착륙 점수 선택지 | `LANDING_OPTIONS` |
| 랩타임 구간별 점수 | `TIME_BRACKETS`, `TIME_POINTS_INCOMPLETE` |

만점(Total)은 위 값에서 **자동 계산**됩니다. 화면 디자인은 `src/App.jsx` 에 있습니다.

> `COLLECTION_NAME` 을 바꾸면 `firestore.rules` 의 `match /orbital_scores_2026/` 부분도 같은 이름으로 바꿔야 합니다.

## 5. GitHub에 저장하기 (수정 후)

VS Code 왼쪽 **소스 제어(가지 모양 아이콘)** → 변경 내용 메시지 입력 → **커밋** → **동기화(Sync/Push)**.

## 6. 웹에 배포하기 (GitHub Pages, 무료)

1. 저장소 **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions → New repository secret** 으로 `.env` 의 6개 값을 같은 이름으로 등록
3. `main` 에 push 하면 자동 배포 → `https://<계정>.github.io/drone-chase-scoring/`

(Netlify를 쓰는 경우: Build command `npm run build`, Publish directory `dist`, 환경변수에 같은 6개 값 등록)

## 7. 보안 안내

- 접속 코드는 **화면 잠금** 용도입니다. 코드가 웹페이지 소스에 포함되므로 진짜 보안 장치는 아닙니다.
- 실제 데이터 보호는 **Firestore 보안 규칙**이 담당합니다. 대회가 끝나면 규칙의 날짜를 지나게 하거나 읽기/쓰기를 막아 두세요.
- 더 엄격히 하려면 Firebase Authentication(익명 로그인 또는 심판 계정)을 추가하고 규칙에서 `request.auth != null` 을 요구하는 방식을 권장합니다.

## 원본 코드 대비 수정 사항

| # | 문제 | 수정 |
|---|---|---|
| 1 | 전송 실패해도 "Sync Complete" 화면이 표시되어 기록 누락을 알 수 없음 | 저장 성공 시에만 완료 화면, 실패 시 입력값 유지 + 오류 안내 |
| 2 | 제출 버튼 연타 시 중복 저장 가능 | 저장 중 버튼 비활성화 |
| 3 | 전체 삭제(`forEach(async)`)가 완료를 기다리지 않고 오류도 잡지 못함 | Firestore 일괄 삭제(writeBatch) + `RESET` 입력 2단계 확인 |
| 4 | 수정 모달이 state를 직접 변경, `obstacles` 없는 기록에서 오류, 수정 중 삭제되면 화면 오류 | 정규화한 복사본 사용, 삭제 시 모달 자동 닫힘 |
| 5 | 수정 시 문서에 `id` 필드까지 저장됨 | 저장 필드만 골라서 저장 |
| 6 | 정렬 비교 함수가 둘 다 DNF일 때 일관되지 않음 | 총점 → 랩타임 → 제출순, 동점자 같은 순위 |
| 7 | CSV에서 이름에 쉼표가 있으면 칸이 밀리고, `#` 문자에서 잘림 | CSV 이스케이프 + Blob 방식 저장 |
| 8 | 수정/삭제 버튼이 마우스 hover 에서만 보여 **태블릿에서 사용 불가** | 항상 표시 |
| 9 | `animate-fade-in` 클래스가 Tailwind에 정의되어 있지 않음 | `tailwind.config.js` 에 정의 |
| 10 | Firebase 키가 코드에 하드코딩 | `.env` 로 분리(깃허브에 올라가지 않음) |
| 11 | 점수 입력 검증 없음(음수 랩타임 등) | 입력 검증 추가 |
| 12 | 배점이 코드 곳곳에 흩어져 있어 수정 어려움 | `src/config.js` 한 곳으로 모음 |
