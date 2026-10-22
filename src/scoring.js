import {
  OBSTACLES, POINTS_PER_OBSTACLE, LANDING_OPTIONS,
  TIME_BRACKETS, TIME_POINTS_INCOMPLETE,
} from './config';

export const MAX_MISSION = OBSTACLES.length * POINTS_PER_OBSTACLE;
export const MAX_LANDING = Math.max(...LANDING_OPTIONS.map((o) => o.value));
export const MAX_TIME = Math.max(...TIME_BRACKETS.map((b) => b.points));
export const MAX_TOTAL = MAX_MISSION + MAX_LANDING + MAX_TIME;

export const emptyObstacles = () => OBSTACLES.map(() => false);

/** 저장된 obstacles 배열을 현재 장애물 개수에 맞게 정리 (구버전·손상 데이터 대비) */
export const normalizeObstacles = (obs) =>
  OBSTACLES.map((_, i) => Boolean(Array.isArray(obs) && obs[i]));

export const missionScoreOf = (obstacles) =>
  normalizeObstacles(obstacles).filter(Boolean).length * POINTS_PER_OBSTACLE;

export const timeScoreOf = (missionScore, lapTime) => {
  const t = Number(lapTime) || 0;
  if (t <= 0) return 0; // DNF
  if (missionScore < MAX_MISSION) return TIME_POINTS_INCOMPLETE;
  return TIME_BRACKETS.find((b) => t <= b.maxSec)?.points ?? 0;
};

/** 기록 1건 → 계산된 점수 포함 객체 */
export const computeRow = (item) => {
  const missionScore = missionScoreOf(item.obstacles);
  const landingScore = Number(item.landingScore) || 0;
  const lapTime = Number(item.lapTime) || 0;
  const timeScore = timeScoreOf(missionScore, lapTime);
  return {
    ...item,
    missionScore,
    landingScore,
    lapTime,
    timeScore,
    totalScore: missionScore + landingScore + timeScore,
  };
};

/** 순위 정렬: 총점 ↓ → 랩타임 ↑ (DNF는 뒤) → 먼저 제출한 순 */
export const compareRows = (a, b) => {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  const aDnf = a.lapTime <= 0;
  const bDnf = b.lapTime <= 0;
  if (aDnf !== bDnf) return aDnf ? 1 : -1;
  if (!aDnf && a.lapTime !== b.lapTime) return a.lapTime - b.lapTime;
  return (a.timestamp || 0) - (b.timestamp || 0);
};

/** 동점자(총점·랩타임 동일)는 같은 순위 */
export const rankRows = (rows) => {
  const sorted = rows.map(computeRow).sort(compareRows);
  const ranked = [];
  sorted.forEach((row, i) => {
    const prev = ranked[i - 1];
    const tied = prev && prev.totalScore === row.totalScore && prev.lapTime === row.lapTime;
    ranked.push({ ...row, rank: tied ? prev.rank : i + 1 });
  });
  return ranked;
};

/** 채점 기록과 명단을 맞춰 보는 열쇠: 참가번호 + 이름 (공백·대소문자 무시)
 *  번호만으로 비교하면, 예전 시험 기록이나 다른 사람의 같은 번호 기록 때문에 '완료'로 잘못 보일 수 있음 */
export const personKey = (p) =>
  `${String(p?.bib ?? '').trim()}|${String(p?.name ?? '').replace(/\s+/g, '').toLowerCase()}`;
