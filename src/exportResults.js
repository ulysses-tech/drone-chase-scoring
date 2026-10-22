// =============================================================================
//  결과 엑셀 내려받기 (HQ Dashboard)
//  - 제목 줄: 1행 한국어, 2행 영어
//  - 시트: 시상용(최고 기록) · 1차 · 2차 · 전체 기록 — 모두 부문별 순위
// =============================================================================
import { saveWorkbook } from './saveWorkbook';
import { MAX_MISSION, MAX_LANDING, MAX_TIME, MAX_TOTAL } from './scoring';
import { ROUNDS, RESULT_FILENAME, COMPETITION } from './config';
import { divisionInfo, divisionKeyOf, groupByDivision } from './divisions';
import { roundOf, roundInfo, bestPerPerson } from './rounds';

const lap = (r) => (r.lapTime > 0 ? Number(r.lapTime.toFixed(2)) : 'DNF');
const when = (t) => (t ? new Date(t).toLocaleString('ko-KR') : '');

/** [한국어 제목, 영어 제목, 값 함수] */
const baseColumns = (roundCol) => [
  ['부문', 'Division', (r) => divisionInfo(divisionKeyOf(r)).label],
  ['부문 순위', 'Division Rank', (r) => r.rank ?? '실격 DQ'],
  roundCol,
  ['참가번호', 'Bib No.', (r) => r.bib],
  ['이름', 'Name', (r) => r.name],
  ['국가', 'Country', (r) => r.country || ''],
  ['소속', 'Affiliation', (r) => r.affiliation || ''],
  ['학년', 'Grade', (r) => r.grade || ''],
  ['성별', 'Gender', (r) => r.gender || ''],
  [`미션 점수 (${MAX_MISSION})`, `Mission (${MAX_MISSION})`, (r) => r.missionScore],
  [`착륙 점수 (${MAX_LANDING})`, `Landing (${MAX_LANDING})`, (r) => r.landingScore],
  ['랩타임 (초)', 'Lap Time (sec)', lap],
  [`시간 점수 (${MAX_TIME})`, `Time Points (${MAX_TIME})`, (r) => r.timeScore],
  [`총점 (${MAX_TOTAL})`, `Total (${MAX_TOTAL})`, (r) => r.totalScore],
  ['실격', 'DQ', (r) => (r.dq ? '실격 DQ' : '')],
];
const tailColumns = [
  ['심판', 'Judge', (r) => r.judge || ''],
  ['서명', 'Signed', (r) => (r.signature ? 'O' : 'X')],
  ['제출 시각', 'Submitted', (r) => when(r.timestamp)],
];

const roundColumn = ['차수', 'Round', (r) => roundInfo(roundOf(r)).label];

function buildSheet(XLSX, rows, columns) {
  const byDiv = groupByDivision(rows);
  const body = Object.values(byDiv).flat().map((r) => columns.map((c) => c[2](r)));
  const aoa = [columns.map((c) => c[0]), columns.map((c) => c[1]), ...body];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(8, c[0].length * 2 + 2, c[1].length + 2) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 2 };
  return ws;
}

export async function exportResults(scores) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // 1) 시상용: 참가자별 최고 기록 + 차수별 총점
  const bestCols = [
    ...baseColumns(['최고 기록 차수', 'Best Round', (r) => roundInfo(r.bestRound).label]),
    ...ROUNDS.map((rd) => [`${rd.label} 총점`, `${rd.en} Total`, (r) => {
      const t = r.roundTotals?.[rd.key];
      if (t === undefined) return '';
      return r.roundDq?.[rd.key] ? `${t} (실격)` : t;
    }]),
    ...tailColumns,
  ];
  XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, bestPerPerson(scores), bestCols), '시상용(최고기록)');

  // 2) 차수별
  const cols = [...baseColumns(roundColumn), ...tailColumns];
  ROUNDS.forEach((rd) => {
    XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, scores.filter((s) => roundOf(s) === rd.key), cols), rd.label);
  });

  // 3) 전체 기록 (1·2차 모두)
  XLSX.utils.book_append_sheet(wb, buildSheet(XLSX, scores, cols), '전체 기록');

  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  saveWorkbook(XLSX, wb, `${RESULT_FILENAME || COMPETITION.title}_${stamp}.xlsx`);
}
