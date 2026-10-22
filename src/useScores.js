import { useEffect, useState, useCallback, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, push, set, update, remove, onDisconnect } from 'firebase/database';
import { DB_PATH } from './config';
import { firebaseConfig } from './firebaseConfig';

// -----------------------------------------------------------------------------
//  Firebase Realtime Database 연결
//  firebaseConfig 의 databaseURL 이 비어 있으면 '데모 모드'(이 기기 브라우저에만 저장)
//
//  저장 구조 (DB_PATH = 'drone_chase_2026')
//    drone_chase_2026/{기록ID}          ← 채점 기록 (서명 포함)
//    drone_chase_2026/_roster/{명단ID}  ← 참가자 명단 (HQ에서 엑셀로 올림)
//    drone_chase_2026/_claims/{명단ID}  ← 지금 어느 심판이 채점 중인지 (중복 선택 방지)
//  '_' 로 시작하는 항목은 기록 목록에서 제외됩니다.
// -----------------------------------------------------------------------------
export const isCloudMode = Boolean(firebaseConfig.databaseURL && firebaseConfig.apiKey);

let db = null;
if (isCloudMode) {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    db = getDatabase(app);
  } catch (e) {
    console.error('Firebase initialization failed:', e);
  }
}

const WRITE_TIMEOUT_MS = 10000;
/** '채점 중' 표시가 이 시간보다 오래되면 무시 (태블릿이 꺼진 경우 대비) */
export const CLAIM_TTL_MS = 20 * 60 * 1000;

/** 서버 응답을 기다리되, 너무 오래 걸리면 실패로 처리 */
const withTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), WRITE_TIMEOUT_MS)),
  ]);

const str = (v) => String(v ?? '').trim();

/** 참가자 부가 정보 (명단에서 가져와 기록에 함께 저장) */
export const PROFILE_FIELDS = ['country', 'affiliation', 'grade', 'gender'];

// 저장할 필드만 골라냄 (id·계산값이 섞여 들어가지 않도록)
const pickFields = (r) => ({
  bib: str(r.bib),
  name: str(r.name),
  ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, str(r[k])])),
  judge: str(r.judge),
  obstacles: Array.isArray(r.obstacles) ? r.obstacles.map(Boolean) : [],
  landingScore: Number(r.landingScore) || 0,
  lapTime: Number(r.lapTime) || 0,
});

// ── 데모 모드 저장소 (localStorage) ─────────────────────────────────────
const LOCAL_KEY = `demo_${DB_PATH}`;
const LOCAL_ROSTER = `demo_${DB_PATH}_roster`;
const LOCAL_CLAIMS = `demo_${DB_PATH}_claims`;
const readJSON = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
};
const writeJSON = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ }
  window.dispatchEvent(new Event('local-scores-changed'));
};
const readLocal = () => readJSON(LOCAL_KEY, []);
const writeLocal = (rows) => writeJSON(LOCAL_KEY, rows);

const rosterFromObject = (obj) =>
  Object.entries(obj || {})
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

/**
 * 점수·명단 데이터 훅.
 * status: connecting | online | offline | error | demo
 * 모든 쓰기 함수는 { ok: boolean, reason?: 'offline' | 'timeout' | 'denied' | 'error' } 를 돌려줍니다.
 */
export function useScores() {
  const [scores, setScores] = useState([]);
  const [roster, setRoster] = useState([]);
  const [claims, setClaims] = useState({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const connectedRef = useRef(false);
  connectedRef.current = connected;

  useEffect(() => {
    if (!isCloudMode || !db) {
      const sync = () => {
        setScores(readLocal());
        setRoster(rosterFromObject(readJSON(LOCAL_ROSTER, {})));
        setClaims(readJSON(LOCAL_CLAIMS, {}));
      };
      sync();
      window.addEventListener('local-scores-changed', sync);
      window.addEventListener('storage', sync); // 다른 탭과 동기화
      return () => {
        window.removeEventListener('local-scores-changed', sync);
        window.removeEventListener('storage', sync);
      };
    }

    const offConn = onValue(ref(db, '.info/connected'), (s) => setConnected(s.val() === true));
    const offData = onValue(
      ref(db, DB_PATH),
      (snap) => {
        const val = snap.val() || {};
        setScores(
          Object.entries(val)
            .filter(([id]) => !id.startsWith('_'))
            .map(([id, v]) => ({ id, ...v }))
        );
        setRoster(rosterFromObject(val._roster));
        setClaims(val._claims || {});
        setLoaded(true);
        setError(null);
      },
      (err) => {
        console.error('Firebase sync error:', err);
        setError(err?.code || 'error');
      }
    );
    return () => { offConn(); offData(); };
  }, []);

  let status = 'demo';
  if (isCloudMode && db) {
    if (error) status = 'error';
    else if (connected && loaded) status = 'online';
    else if (loaded) status = 'offline';
    else status = 'connecting';
  }

  /** 클라우드 쓰기 공통 처리 */
  const cloudWrite = async (fn) => {
    // 연결이 끊긴 상태에서 쓰면 기기에 대기했다가 나중에 전송되어 중복 제출 위험 → 아예 막음
    if (!connectedRef.current) return { ok: false, reason: 'offline' };
    try {
      await withTimeout(fn());
      return { ok: true };
    } catch (e) {
      console.error('Write failed:', e);
      if (e?.message === 'timeout') return { ok: false, reason: 'timeout' };
      if (String(e?.code || e?.message).toLowerCase().includes('permission')) return { ok: false, reason: 'denied' };
      return { ok: false, reason: 'error' };
    }
  };

  // ── 채점 기록 ─────────────────────────────────────────────────────────
  const addScore = useCallback(async (record) => {
    const data = { ...pickFields(record), timestamp: Date.now() };
    if (record.rosterId) data.rosterId = record.rosterId;
    // 학생 서명 이미지(PNG data URL) — 수정(update) 때는 건드리지 않아 그대로 유지됨
    if (record.signature) data.signature = record.signature;
    if (!isCloudMode || !db) {
      writeLocal([...readLocal(), { id: crypto.randomUUID?.() || String(Date.now()), ...data }]);
      return { ok: true };
    }
    return cloudWrite(() => set(push(ref(db, DB_PATH)), data));
  }, []);

  const updateScore = useCallback(async (record) => {
    const data = { ...pickFields(record), updatedAt: Date.now() };
    if (!isCloudMode || !db) {
      writeLocal(readLocal().map((r) => (r.id === record.id ? { ...r, ...data } : r)));
      return { ok: true };
    }
    return cloudWrite(() => update(ref(db, `${DB_PATH}/${record.id}`), data));
  }, []);

  const deleteScore = useCallback(async (id) => {
    if (!isCloudMode || !db) {
      writeLocal(readLocal().filter((r) => r.id !== id));
      return { ok: true };
    }
    return cloudWrite(() => remove(ref(db, `${DB_PATH}/${id}`)));
  }, []);

  // 전체 삭제 — 채점 기록만 지움 (참가자 명단은 유지). IDRCC 기록에는 영향 없음
  const clearScores = useCallback(async (ids) => {
    if (!isCloudMode || !db) {
      writeLocal([]);
      writeJSON(LOCAL_CLAIMS, {});
      return { ok: true };
    }
    const updates = { _claims: null };
    ids.forEach((id) => { updates[id] = null; });
    return cloudWrite(() => update(ref(db, DB_PATH), updates));
  }, []);

  // ── 참가자 명단 ───────────────────────────────────────────────────────
  /** 명단 전체 교체 (entries: [{order, bib, name, country, ...}]) */
  const saveRoster = useCallback(async (entries) => {
    const obj = {};
    entries.forEach((e, i) => {
      obj[`p${String(i + 1).padStart(4, '0')}`] = {
        order: Number(e.order) || i + 1,
        bib: str(e.bib),
        name: str(e.name),
        group: str(e.group),
        ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, str(e[k])])),
      };
    });
    if (!isCloudMode || !db) {
      writeJSON(LOCAL_ROSTER, obj);
      writeJSON(LOCAL_CLAIMS, {});
      return { ok: true };
    }
    return cloudWrite(() => update(ref(db, DB_PATH), { _roster: obj, _claims: null }));
  }, []);

  const clearRoster = useCallback(async () => saveRoster([]), [saveRoster]);

  // ── 채점 중 표시 (여러 심판이 같은 참가자를 고르지 않도록) ──────────────
  const claimParticipant = useCallback(async (rosterId, judge, device) => {
    const data = { judge: str(judge) || 'Judge', device: str(device), at: Date.now() };
    if (!isCloudMode || !db) {
      writeJSON(LOCAL_CLAIMS, { ...readJSON(LOCAL_CLAIMS, {}), [rosterId]: data });
      return { ok: true };
    }
    const r = ref(db, `${DB_PATH}/_claims/${rosterId}`);
    const res = await cloudWrite(() => set(r, data));
    // 태블릿 연결이 끊기면 서버가 자동으로 표시를 지움
    if (res.ok) onDisconnect(r).remove().catch(() => {});
    return res;
  }, []);

  const releaseParticipant = useCallback(async (rosterId) => {
    if (!rosterId) return { ok: true };
    if (!isCloudMode || !db) {
      const c = readJSON(LOCAL_CLAIMS, {});
      delete c[rosterId];
      writeJSON(LOCAL_CLAIMS, c);
      return { ok: true };
    }
    const r = ref(db, `${DB_PATH}/_claims/${rosterId}`);
    onDisconnect(r).cancel().catch(() => {});
    if (!connectedRef.current) return { ok: true };
    return cloudWrite(() => remove(r));
  }, []);

  return {
    scores, roster, claims, status,
    addScore, updateScore, deleteScore, clearScores,
    saveRoster, clearRoster, claimParticipant, releaseParticipant,
  };
}

/** 쓰기 실패 사유 → 안내 문구 */
export const failMessage = (reason) =>
  ({
    offline: '인터넷 연결이 끊겨 있습니다. 연결(Live 표시)을 확인한 뒤 다시 누르세요.',
    timeout: '서버 응답이 늦습니다. HQ 순위표에 기록이 들어갔는지 확인한 뒤 필요하면 다시 제출하세요.',
    denied: '저장 권한이 없습니다. Firebase 보안 규칙(README 참고)을 확인하세요.',
  })[reason] || '저장 실패 — 인터넷 연결을 확인하세요.';
