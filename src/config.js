// =============================================================================
//  대회 설정 파일 — 대회 이름, 비밀번호, 배점 등은 이 파일만 고치면 됩니다.
//  (다른 대회용으로 고쳐 쓸 때도 대부분 이 파일만 수정하면 됩니다.)
// =============================================================================

export const COMPETITION = {
  title: 'Drone Chase',                       // 상단 큰 제목
  subtitle: 'Orbital Pursuit 2026',           // 보조 제목
  event: 'XXVI Mongolian Technical Olympiad', // 행사명
  year: 2026,
};

// 접속 비밀번호 (화면 잠금용 — 보안 장치는 아닙니다. README '보안' 항목 참고)
export const ADMIN_PASSWORD = '2026';

// Firebase Realtime Database 안의 저장 위치 (대회마다 다르게 두면 기록이 섞이지 않습니다)
// ※ IDRCC 채점 앱이 쓰는 'scores', 'signatures' 와 같은 이름은 쓰지 마세요.
export const DB_PATH = 'drone_chase_2026';

// CSV 저장 파일명
export const CSV_FILENAME = 'Drone_Chase_2026_Results.csv';

// ── 1) 미션(장애물) : 통과한 개수 × 점수 ────────────────────────────────
export const OBSTACLES = [
  { label: 'Obstacle 1', sub: 'Low' },
  { label: 'Obstacle 2', sub: 'Mid' },
  { label: 'Obstacle 3', sub: 'High' },
];
export const POINTS_PER_OBSTACLE = 10;

// ── 2) 착륙 정확도 ──────────────────────────────────────────────────
export const LANDING_OPTIONS = [
  { value: 10, label: '4 Motors', desc: 'Perfect' },
  { value: 8, label: '3 Motors', desc: '' },
  { value: 6, label: '2 Motors', desc: '' },
  { value: 4, label: '1 Motor', desc: '' },
  { value: 2, label: 'Safe', desc: 'Inside 80cm' },
  { value: 0, label: 'Missed', desc: 'Outside target' },
];
export const DEFAULT_LANDING = 10;

// ── 3) 랩타임 점수 ─────────────────────────────────────────────────
//  미션을 모두 완료한 경우: 기록 구간별 점수 (위에서부터 차례로 비교)
export const TIME_BRACKETS = [
  { maxSec: 30, points: 10 },
  { maxSec: 45, points: 8 },
  { maxSec: 60, points: 6 },
  { maxSec: Infinity, points: 4 },
];
//  미션을 다 못 했지만 기록이 있는 경우
export const TIME_POINTS_INCOMPLETE = 2;
//  기록 없음(DNF) = 0점
