import { saveWorkbook } from './saveWorkbook';
import { matchDivision } from './divisions';

// =============================================================================
//  참가자 명단 엑셀(.xlsx / .xls / .csv) 읽기 · 빈 양식 만들기
//  - 첫 줄(제목 줄)의 이름으로 칸을 찾습니다. 순서는 자유, 한글·영어 모두 인식.
//  - 엑셀 라이브러리는 필요할 때만 불러옵니다(첫 화면 속도 유지).
// =============================================================================

/** 제목 줄 이름 → 항목. 공백·대소문자·괄호는 무시하고 비교합니다. */
const HEADER_ALIASES = {
  order: ['순서', '순번', '출전순서', 'no', 'order', 'seq'],
  bib: ['참가번호', '배번', '배번호', '번호', '선수번호', 'bib', 'bibno', 'number', 'id'],
  division: ['부문', '구분', '카테고리', '리그', '학교급', 'division', 'category', 'league'],
  name: ['이름', '성명', '선수명', '참가자', '참가자명', '팀명', 'name', 'participant', 'player'],
  country: ['국가', '나라', '국적', 'country', 'nation', 'nationality'],
  affiliation: ['소속', '학교', '기관', '소속기관', '팀', 'affiliation', 'school', 'team', 'organization', 'org'],
  grade: ['학년', '나이', 'grade', 'year', 'class', 'age'],
  gender: ['성별', 'gender', 'sex'],
  group: ['조', '코스', '그룹', '경기장', 'group', 'course', 'heat', 'field'],
};

const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s()[\]·._\-/]/g, '');
const ALIAS_LOOKUP = Object.fromEntries(
  Object.entries(HEADER_ALIASES).flatMap(([key, names]) => names.map((n) => [norm(n), key]))
);

/** 제목 칸 → 항목. '참가번호\nBib No.' 처럼 한 칸에 두 줄로 적어도 인식 */
const headerKey = (c) => {
  const whole = ALIAS_LOOKUP[norm(c)];
  if (whole) return whole;
  for (const part of String(c ?? '').split(/[\n/]/)) {
    const k = ALIAS_LOOKUP[norm(part)];
    if (k) return k;
  }
  return undefined;
};

/** 양식 제목: 1행 한국어, 2행 영어 */
export const TEMPLATE_HEADERS = ['순서', '참가번호', '이름', '부문', '국가', '소속', '학년', '성별', '조'];
export const TEMPLATE_HEADERS_EN = ['Order', 'Bib No.', 'Name', 'Division', 'Country', 'Affiliation', 'Grade', 'Gender', 'Group'];

/**
 * 파일을 읽어 { entries, warnings, columns } 를 돌려줍니다.
 * entries: [{ order, bib, name, country, affiliation, grade, gender, group }]
 */
export async function parseRosterFile(file) {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: false });
  if (!rows.length) throw new Error('파일에 내용이 없습니다.');

  // 제목 줄 찾기: 위에서 10줄 안에서 '이름'이나 '참가번호'가 있는 첫 줄
  const headerIdx = rows.slice(0, 10).findIndex((r) => r.some((c) => ['name', 'bib'].includes(headerKey(c))));
  if (headerIdx < 0) throw new Error("제목 줄을 찾지 못했습니다. 첫 줄에 '참가번호', '이름' 같은 제목을 넣어 주세요.");

  const colMap = {};
  rows[headerIdx].forEach((c, i) => {
    const key = headerKey(c);
    if (key && colMap[key] === undefined) colMap[key] = i;
  });
  if (colMap.name === undefined && colMap.bib === undefined) {
    throw new Error("'참가번호' 또는 '이름' 칸이 필요합니다.");
  }

  const warnings = [];
  const entries = [];
  // 제목 바로 아래 줄이 영어 제목 줄(Order, Bib No., Name …)이면 건너뜀
  let dataStart = headerIdx + 1;
  const nextRow = rows[dataStart] || [];
  const filled = nextRow.filter((c) => String(c).trim() !== '');
  if (filled.length && filled.every((c) => headerKey(c))) dataStart += 1;

  rows.slice(dataStart).forEach((r, i) => {
    const line = dataStart + i + 1; // 엑셀의 줄 번호
    const get = (k) => (colMap[k] === undefined ? '' : String(r[colMap[k]] ?? '').trim());
    const e = {
      order: get('order'),
      bib: get('bib'),
      name: get('name'),
      country: get('country'),
      affiliation: get('affiliation'),
      grade: get('grade'),
      gender: get('gender'),
      group: get('group'),
    };
    if (!e.bib && !e.name) return; // 빈 줄
    // 부문: '부문' 칸 → 없거나 못 알아보면 '학년' 칸(초6·중2·고1·대3)에서 판단
    const divText = get('division');
    e.division = matchDivision(divText) || matchDivision(e.grade);
    if (!e.division) {
      warnings.push(`${line}번째 줄 (${e.name || e.bib}): 부문을 알 수 없습니다${divText ? ` ('${divText}')` : ''}. 심판 화면에서 부문을 골라야 합니다.`);
    }
    if (!e.name) warnings.push(`${line}번째 줄: 이름이 비어 있습니다.`);
    if (!e.bib) warnings.push(`${line}번째 줄: 참가번호가 비어 있습니다.`);
    entries.push(e);
  });

  // 순서 칸이 없거나 숫자가 아니면 엑셀의 줄 순서를 그대로 사용
  const hasOrder = entries.length && entries.every((e) => e.order !== '' && !Number.isNaN(Number(e.order)));
  entries.forEach((e, i) => { e.order = hasOrder ? Number(e.order) : i + 1; });
  entries.sort((a, b) => a.order - b.order);

  // 참가번호 중복 확인
  const seen = new Map();
  entries.forEach((e) => {
    if (!e.bib) return;
    if (seen.has(e.bib)) warnings.push(`참가번호 ${e.bib} 이(가) 중복됩니다: ${seen.get(e.bib)}, ${e.name}`);
    else seen.set(e.bib, e.name);
  });

  if (!entries.length) throw new Error('명단에 참가자가 없습니다.');
  return { entries, warnings, columns: Object.keys(colMap) };
}

/** 빈 양식(.xlsx) 내려받기 — 예시 3줄 포함 */
export async function downloadRosterTemplate(filename = 'Drone_Chase_Roster_Template.xlsx') {
  const XLSX = await import('xlsx');
  const data = [
    TEMPLATE_HEADERS,
    TEMPLATE_HEADERS_EN,
    [1, '101', '(예시) 홍길동', '초등부', 'Korea', 'OO초등학교', '6', '남', 'A'],
    [2, '102', '(예시) 김하늘', '중등부', 'Korea', '광신중학교', '중2', '여', 'A'],
    [3, '103', '(예시) Bat-Erdene', '고등부', 'Mongolia', 'MNUE Lab School', '고1', 'M', 'B'],
    [4, '104', '(예시) Nguyen An', '일반부', 'Vietnam', 'Hanoi University', '대3', 'F', 'B'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 8 }, { wch: 10 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '명단');
  saveWorkbook(XLSX, wb, filename);
}
