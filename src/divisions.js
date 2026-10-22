import { DIVISIONS } from './config';
import { rankRows } from './scoring';

// 부문별 배지 색 (config.js 의 DIVISIONS 순서대로)
const COLORS = [
  'bg-lime-100 text-lime-900 border-lime-300',
  'bg-sky-100 text-sky-900 border-sky-300',
  'bg-violet-100 text-violet-900 border-violet-300',
  'bg-orange-100 text-orange-900 border-orange-300',
  'bg-pink-100 text-pink-900 border-pink-300',
  'bg-teal-100 text-teal-900 border-teal-300',
];
export const UNASSIGNED = '_none';

const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s()[\]·._\-/]/g, '');

/** 글자(예: '중등부', '중2', 'High School', '대학 3')에서 부문 key 를 찾음. 못 찾으면 '' */
export function matchDivision(text) {
  const t = norm(text);
  if (!t) return '';
  const byKey = DIVISIONS.find((d) => norm(d.key) === t || norm(d.label) === t || norm(d.en) === t);
  if (byKey) return byKey.key;
  for (const d of DIVISIONS) {
    if (d.aliases.some((a) => norm(a) === t)) return d.key;
  }
  // '중2', '고1', '초6', '대3', '대학3학년', 'high2' 처럼 앞부분으로 판단 (긴 말부터 비교)
  const pairs = DIVISIONS.flatMap((d) => d.aliases.map((a) => [norm(a), d.key])).sort((a, b) => b[0].length - a[0].length);
  for (const [a, key] of pairs) {
    if (a && t.startsWith(a) && /^[\d학년]*$/.test(t.slice(a.length))) return key;
  }
  return '';
}

export const divisionInfo = (key) => {
  const i = DIVISIONS.findIndex((d) => d.key === key);
  if (i < 0) return { key: UNASSIGNED, label: '미분류', en: 'Unassigned', color: 'bg-slate-100 text-slate-600 border-slate-300' };
  return { ...DIVISIONS[i], color: COLORS[i % COLORS.length] };
};

/** 기록의 부문 key (없거나 모르는 부문이면 UNASSIGNED) */
export const divisionKeyOf = (r) => (DIVISIONS.some((d) => d.key === r?.division) ? r.division : UNASSIGNED);

/** 부문별로 나눠 각 부문 안에서 순위를 매김 → { elementary: [...], middle: [...], ..., _none?: [...] } */
export function groupByDivision(rows) {
  const out = {};
  [...DIVISIONS.map((d) => d.key), UNASSIGNED].forEach((k) => {
    const list = rows.filter((r) => divisionKeyOf(r) === k);
    if (list.length || k !== UNASSIGNED) out[k] = rankRows(list);
  });
  return out;
}
