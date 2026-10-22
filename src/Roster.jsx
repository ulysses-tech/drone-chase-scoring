import React, { useMemo, useRef, useState } from 'react';
import {
  Users, ChevronRight, Search, CheckCircle2, Loader2, Upload, FileSpreadsheet, Trash2, X,
  AlertTriangle, UserCheck, ListOrdered,
} from 'lucide-react';
import { CLAIM_TTL_MS, failMessage } from './useScores';
import { parseRosterFile, downloadRosterTemplate } from './rosterFile';
import { divisionInfo } from './divisions';

/** 부문 배지 (초등부·중등부·고등부·일반부) */
export function DivisionBadge({ division, size = 'sm' }) {
  const d = divisionInfo(division);
  const sz = size === 'lg' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5';
  return <span className={`inline-block shrink-0 rounded-md border font-black whitespace-nowrap ${sz} ${d.color}`}>{d.label}</span>;
}

// =============================================================================
//  참가자 명단 — 심판용 선택 패널(RosterPicker) / HQ용 명단 관리(RosterManager)
// =============================================================================

const storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/** 이 태블릿 고유 ID (같은 이름의 심판이 있어도 구분) */
export const DEVICE_ID = (() => {
  let id = storage.get('drone_chase_device');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    storage.set('drone_chase_device', id);
  }
  return id;
})();

/** 채점 기록과 명단을 맞춰 보는 열쇠: 참가번호 + 이름 (공백·대소문자 무시)
 *  번호만으로 비교하면, 예전 시험 기록이나 다른 사람의 같은 번호 기록 때문에 '완료'로 잘못 보일 수 있음 */
export const personKey = (p) =>
  `${String(p?.bib ?? '').trim()}|${String(p?.name ?? '').replace(/\s+/g, '').toLowerCase()}`;

/** 다른 기기의 유효한 '채점 중' 표시인지 */
export const claimedByOther = (claim) =>
  Boolean(claim && claim.device !== DEVICE_ID && Date.now() - (Number(claim.at) || 0) < CLAIM_TTL_MS);

/** 국가 · 소속 · 학년 · 성별 한 줄 */
export const profileLine = (p) =>
  [p.country, p.affiliation, p.grade && `${p.grade}${/^\d+$/.test(p.grade) ? '학년' : ''}`, p.gender]
    .filter(Boolean)
    .join(' · ');

/** 명단 항목의 상태: done | busy | mine | wait */
const statusOf = (entry, { scoredKeys, claims, selectedId }) => {
  if (entry.id === selectedId) return 'mine';
  if (scoredKeys.has(personKey(entry))) return 'done';
  if (claimedByOther(claims[entry.id])) return 'busy';
  return 'wait';
};

function StatusChip({ status, claim }) {
  const map = {
    done: ['bg-emerald-100 text-emerald-800', '✓ 완료'],
    busy: ['bg-amber-100 text-amber-900', `채점 중${claim?.judge ? ` · ${claim.judge}` : ''}`],
    mine: ['bg-blue-600 text-white', '선택됨'],
    wait: ['bg-slate-100 text-slate-700', '대기'],
  };
  const [cls, text] = map[status];
  return <span className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-lg whitespace-nowrap ${cls}`}>{text}</span>;
}

// -----------------------------------------------------------------------------
//  심판용: 다음 순서 / 명단에서 선택
// -----------------------------------------------------------------------------
export function RosterPicker({
  roster, claims, scores, selectedId, judgeName, setJudgeName, group, setGroup, onSelect, busy,
}) {
  const [showList, setShowList] = useState(false);
  const [query, setQuery] = useState('');

  const scoredKeys = useMemo(() => new Set(scores.map(personKey)), [scores]);
  const groups = useMemo(() => [...new Set(roster.map((r) => r.group).filter(Boolean))].sort(), [roster]);
  const inGroup = group && groups.includes(group) ? roster.filter((r) => r.group === group) : roster;
  const ctx = { scoredKeys, claims, selectedId };

  const doneCount = inGroup.filter((r) => scoredKeys.has(personKey(r))).length;
  const next = inGroup.find((r) => statusOf(r, ctx) === 'wait');
  const selected = roster.find((r) => r.id === selectedId);

  const q = query.trim().toLowerCase();
  const listed = q
    ? inGroup.filter((r) => `${r.bib} ${r.name} ${r.affiliation} ${r.country}`.toLowerCase().includes(q))
    : inGroup;

  return (
    <section className="mb-5 bg-white border-2 border-blue-200 rounded-2xl shadow-sm overflow-hidden">
      {/* 머리줄: 심판 이름 · 조 · 진행 현황 */}
      <div className="px-5 sm:px-6 py-4 bg-blue-50 border-b border-blue-100 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <Users size={22} className="text-blue-700" />
          <h3 className="text-lg font-black text-slate-900">참가자 명단</h3>
          <span className="text-sm font-bold text-slate-600 tabular-nums">완료 {doneCount} / {inGroup.length}</span>
        </div>
        <label className="flex flex-col text-xs font-bold text-slate-700">
          심판 이름 · Judge
          <input
            value={judgeName}
            onChange={(e) => setJudgeName(e.target.value)}
            placeholder="예: 심판1"
            className="mt-1 h-10 w-32 px-3 rounded-lg border-2 border-slate-300 bg-white text-base font-bold text-slate-900 outline-none focus:border-blue-600"
          />
        </label>
        {groups.length > 0 && (
          <label className="flex flex-col text-xs font-bold text-slate-700">
            조 · 코스
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="mt-1 h-10 px-3 rounded-lg border-2 border-slate-300 bg-white text-base font-bold text-slate-900 outline-none focus:border-blue-600"
            >
              <option value="">전체</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {selected ? (
          <div className="flex flex-wrap items-center gap-4">
            <UserCheck size={28} className="text-blue-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-blue-700">채점 중인 참가자 · 순서 {selected.order}</div>
              <div className="flex items-center gap-2 min-w-0">
                <DivisionBadge division={selected.division} size="lg" />
                <span className="text-2xl font-black text-slate-900 truncate">
                  <span className="tabular-nums">#{selected.bib}</span> {selected.name}
                </span>
              </div>
              {profileLine(selected) && <div className="text-sm font-semibold text-slate-600">{profileLine(selected)}</div>}
            </div>
            <button
              type="button"
              onClick={() => setShowList((v) => !v)}
              className="h-11 px-4 rounded-xl border-2 border-slate-300 text-slate-800 font-bold hover:border-blue-500"
            >
              다른 참가자 선택
            </button>
          </div>
        ) : next ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-slate-600">다음 순서 · {next.order}번째{next.group ? ` · ${next.group}조` : ''}</div>
              <div className="flex items-center gap-2 min-w-0">
                <DivisionBadge division={next.division} size="lg" />
                <span className="text-3xl font-black text-slate-900 truncate">
                  <span className="tabular-nums text-blue-700">#{next.bib}</span> {next.name}
                </span>
              </div>
              {profileLine(next) && <div className="text-base font-semibold text-slate-600">{profileLine(next)}</div>}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSelect(next)}
              className="h-16 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-lg font-black flex items-center gap-2 active:scale-[0.98]"
            >
              {busy ? <Loader2 size={22} className="animate-spin" /> : <ChevronRight size={24} />}
              이 참가자 채점
            </button>
          </div>
        ) : (
          <p className="text-lg font-bold text-emerald-700 flex items-center gap-2">
            <CheckCircle2 size={22} /> {inGroup.length ? '이 명단의 모든 참가자를 채점했거나 다른 심판이 채점 중입니다.' : '명단이 비어 있습니다.'}
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="mt-4 h-10 px-3 -ml-3 rounded-lg inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50"
        >
          <ListOrdered size={16} /> {showList ? '명단 닫기' : '명단에서 직접 찾기 (번호·이름)'}
        </button>

        {showList && (
          <div className="mt-2">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                inputMode="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="참가번호 또는 이름"
                className="w-full h-12 pl-10 pr-3 rounded-xl border-2 border-slate-300 text-lg font-bold outline-none focus:border-blue-600"
              />
            </div>
            <ul className="mt-2 max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {listed.length === 0 && <li className="p-4 text-slate-600 font-semibold">찾는 참가자가 없습니다.</li>}
              {listed.map((r) => {
                const st = statusOf(r, ctx);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={busy || st === 'mine'}
                      onClick={() => { onSelect(r); setShowList(false); setQuery(''); }}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-blue-50 disabled:hover:bg-transparent ${st === 'done' ? 'opacity-60' : ''}`}
                    >
                      <span className="w-8 text-sm font-bold text-slate-500 tabular-nums">{r.order}</span>
                      <span className="w-16 font-black text-slate-900 tabular-nums">#{r.bib}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0"><DivisionBadge division={r.division} /><span className="font-bold text-slate-900 truncate">{r.name}</span></span>
                        {profileLine(r) && <span className="block text-xs font-semibold text-slate-500 truncate">{profileLine(r)}</span>}
                      </span>
                      <StatusChip status={st} claim={claims[r.id]} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function DivisionSummary({ entries }) {
  const counts = {};
  entries.forEach((e) => { counts[e.division || '_none'] = (counts[e.division || '_none'] || 0) + 1; });
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {Object.entries(counts).map(([k, n]) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700">
          <DivisionBadge division={k} size="lg" /> {n}명
        </span>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
//  HQ용: 엑셀 명단 불러오기 · 양식 받기 · 진행 현황
// -----------------------------------------------------------------------------
export function RosterManager({ roster, claims, scores, saveRoster, clearRoster, notify }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null); // { entries, warnings, fileName }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const scoredKeys = useMemo(() => new Set(scores.map(personKey)), [scores]);
  const ctx = { scoredKeys, claims, selectedId: null };
  const done = roster.filter((r) => scoredKeys.has(personKey(r))).length;
  const inProgress = roster.filter((r) => claimedByOther(claims[r.id])).length;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoading(true);
    try {
      const result = await parseRosterFile(file);
      setPreview({ ...result, fileName: file.name });
    } catch (err) {
      notify(err?.message || '파일을 읽지 못했습니다. 엑셀(.xlsx) 또는 CSV 파일인지 확인하세요.');
    } finally {
      setLoading(false);
    }
  };

  const confirmSave = async () => {
    setSaving(true);
    const res = await saveRoster(preview.entries);
    setSaving(false);
    if (res.ok) {
      notify(`참가자 ${preview.entries.length}명을 저장했습니다. 모든 심판 화면에 바로 나타납니다.`, 'success');
      setPreview(null);
    } else {
      notify(failMessage(res.reason));
    }
  };

  const onClear = async () => {
    if (!roster.length) return;
    if (!window.confirm(`참가자 명단 ${roster.length}명을 비울까요?\n(채점 기록은 지워지지 않습니다.)`)) return;
    const res = await clearRoster();
    notify(res.ok ? '명단을 비웠습니다.' : failMessage(res.reason), res.ok ? 'success' : 'error');
  };

  return (
    <section className="mb-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <Users size={22} className="text-blue-700" />
          <h3 className="text-lg font-black text-slate-900">참가자 명단</h3>
          {roster.length > 0 ? (
            <span className="text-sm font-bold text-slate-600 tabular-nums">
              {roster.length}명 · 완료 {done} · 채점 중 {inProgress} · 남음 {roster.length - done}
            </span>
          ) : (
            <span className="text-sm font-semibold text-slate-500">아직 없음 — 엑셀로 불러오세요</span>
          )}
        </div>
        <button type="button" onClick={() => downloadRosterTemplate()} className="h-11 px-4 rounded-xl border-2 border-slate-300 text-slate-800 font-bold flex items-center gap-2 hover:border-blue-500">
          <FileSpreadsheet size={18} /> 양식 받기
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={loading} className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold flex items-center gap-2">
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />} 엑셀 명단 불러오기
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
        {roster.length > 0 && (
          <>
            <button type="button" onClick={() => setOpen((v) => !v)} className="h-11 px-4 rounded-xl border-2 border-slate-300 text-slate-800 font-bold hover:border-blue-500">
              {open ? '명단 접기' : '명단 보기'}
            </button>
            <button type="button" onClick={onClear} className="h-11 w-11 grid place-items-center rounded-xl border-2 border-red-200 text-red-700 hover:bg-red-50" aria-label="명단 비우기" title="명단 비우기">
              <Trash2 size={18} />
            </button>
          </>
        )}
      </div>

      {open && roster.length > 0 && (
        <div className="border-t border-slate-200 max-h-96 overflow-auto">
          <table className="w-full text-left text-sm min-w-[640px]">
            <thead className="bg-slate-100 text-slate-700 font-black sticky top-0">
              <tr>
                <th className="py-2 px-3">순서</th><th className="py-2 px-3">번호</th><th className="py-2 px-3">이름</th><th className="py-2 px-3">부문</th>
                <th className="py-2 px-3">국가 · 소속 · 학년 · 성별</th><th className="py-2 px-3">조</th><th className="py-2 px-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2 px-3 tabular-nums text-slate-600">{r.order}</td>
                  <td className="py-2 px-3 font-black tabular-nums">{r.bib}</td>
                  <td className="py-2 px-3 font-bold">{r.name}</td>
                  <td className="py-2 px-3"><DivisionBadge division={r.division} /></td>
                  <td className="py-2 px-3 text-slate-600">{profileLine(r)}</td>
                  <td className="py-2 px-3">{r.group}</td>
                  <td className="py-2 px-3"><StatusChip status={statusOf(r, ctx)} claim={claims[r.id]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[130] bg-slate-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreview(null)}>
          <div role="dialog" aria-modal="true" aria-label="명단 미리보기" className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-black text-slate-900">명단 미리보기 · {preview.entries.length}명</h3>
                <p className="text-sm font-semibold text-slate-600 truncate">{preview.fileName}</p>
              </div>
              <button onClick={() => setPreview(null)} className="w-10 h-10 grid place-items-center rounded-full hover:bg-slate-100" aria-label="Close"><X size={22} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <DivisionSummary entries={preview.entries} />
              {preview.warnings.length > 0 && (
                <div className="mb-4 rounded-xl bg-amber-50 border border-amber-300 p-3 text-sm text-amber-900 font-semibold">
                  <p className="flex items-center gap-2 font-black"><AlertTriangle size={16} /> 확인이 필요한 줄 {preview.warnings.length}건</p>
                  <ul className="mt-1 list-disc pl-5 max-h-28 overflow-y-auto">{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
                </div>
              )}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-slate-100 font-black text-slate-700">
                    <tr><th className="py-2 px-3">순서</th><th className="py-2 px-3">번호</th><th className="py-2 px-3">이름</th><th className="py-2 px-3">부문</th><th className="py-2 px-3">국가 · 소속 · 학년 · 성별</th><th className="py-2 px-3">조</th></tr>
                  </thead>
                  <tbody>
                    {preview.entries.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-2 px-3 tabular-nums">{r.order}</td>
                        <td className="py-2 px-3 font-black tabular-nums">{r.bib}</td>
                        <td className="py-2 px-3 font-bold">{r.name}</td>
                        <td className="py-2 px-3"><DivisionBadge division={r.division} /></td>
                        <td className="py-2 px-3 text-slate-600">{profileLine(r)}</td>
                        <td className="py-2 px-3">{r.group}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.entries.length > 50 && <p className="mt-2 text-sm text-slate-600 font-semibold">… 외 {preview.entries.length - 50}명</p>}
              {roster.length > 0 && (
                <p className="mt-4 text-sm font-bold text-red-700">저장하면 기존 명단 {roster.length}명이 이 명단으로 바뀝니다. 채점 기록은 그대로 유지됩니다.</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => setPreview(null)} className="h-12 px-5 rounded-xl font-bold text-slate-700 hover:bg-slate-100">취소</button>
              <button onClick={confirmSave} disabled={saving} className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-black flex items-center gap-2">
                {saving && <Loader2 size={18} className="animate-spin" />} {preview.entries.length}명 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
