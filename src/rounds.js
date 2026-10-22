import { ROUNDS } from './config';
import { computeRow, compareRows, personKey } from './scoring';

/** 기록의 차수 (예전 기록처럼 차수가 없으면 1차로 봄) */
export const roundOf = (r) => (ROUNDS.some((x) => x.key === String(r?.round)) ? String(r.round) : ROUNDS[0].key);

export const roundInfo = (key) => ROUNDS.find((x) => x.key === String(key)) || { key, label: `${key}차`, en: `Round ${key}` };

/**
 * 참가자별 최고 기록 1건 (시상용)
 * - 실격이 아닌 기록 우선 → 총점 높은 기록 → 같으면 랩타임 빠른 기록 → 같으면 먼저 제출한 기록
 * - 결과에 roundTotals: { '1': 32, '2': 40 } 와 bestRound 를 붙여 줌
 */
export function bestPerPerson(records) {
  const groups = new Map();
  records.map(computeRow).forEach((r) => {
    const k = personKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  });
  return [...groups.values()].map((list) => {
    const best = [...list].sort(compareRows)[0];
    const roundTotals = {};
    const roundDq = {};
    [...list].sort(compareRows).forEach((r) => {
      const rk = roundOf(r);
      // 같은 차수 기록이 여러 건이면 그중 좋은 기록(정렬 순서상 먼저 나온 기록)
      if (roundTotals[rk] === undefined) {
        roundTotals[rk] = r.totalScore;
        roundDq[rk] = !!r.dq;
      }
    });
    return { ...best, bestRound: roundOf(best), roundTotals, roundDq, attempts: list.length };
  });
}
