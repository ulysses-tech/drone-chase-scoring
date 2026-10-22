import { useEffect, useState, useCallback, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, push, set, update, remove } from 'firebase/database';
import { DB_PATH } from './config';
import { firebaseConfig } from './firebaseConfig';

// -----------------------------------------------------------------------------
//  Firebase Realtime Database 연결
//  firebaseConfig 의 databaseURL 이 비어 있으면 '데모 모드'(이 기기 브라우저에만 저장)
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

/** 서버 응답을 기다리되, 너무 오래 걸리면 실패로 처리 */
const withTimeout = (promise) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), WRITE_TIMEOUT_MS)),
  ]);

// 저장할 필드만 골라냄 (id·계산값이 섞여 들어가지 않도록)
const pickFields = (r) => ({
  bib: String(r.bib ?? '').trim(),
  name: String(r.name ?? '').trim(),
  obstacles: Array.isArray(r.obstacles) ? r.obstacles.map(Boolean) : [],
  landingScore: Number(r.landingScore) || 0,
  lapTime: Number(r.lapTime) || 0,
});

// ── 데모 모드 저장소 (localStorage) ─────────────────────────────────────
const LOCAL_KEY = `demo_${DB_PATH}`;
const readLocal = () => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
};
const writeLocal = (rows) => {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows)); } catch { /* 저장 불가 환경 */ }
  window.dispatchEvent(new Event('local-scores-changed'));
};

/**
 * 점수 데이터 훅.
 * status: connecting | online | offline | error | demo
 * 모든 쓰기 함수는 { ok: boolean, reason?: 'offline' | 'timeout' | 'denied' | 'error' } 를 돌려줍니다.
 */
export function useScores() {
  const [scores, setScores] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const connectedRef = useRef(false);
  connectedRef.current = connected;

  useEffect(() => {
    if (!isCloudMode || !db) {
      const sync = () => setScores(readLocal());
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
        setScores(Object.entries(val).map(([id, v]) => ({ id, ...v })));
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

  const addScore = useCallback(async (record) => {
    const data = { ...pickFields(record), timestamp: Date.now() };
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

  // 전체 삭제 — 드론 추격전 저장 위치(DB_PATH)만 지움. IDRCC 기록에는 영향 없음
  const clearScores = useCallback(async () => {
    if (!isCloudMode || !db) {
      writeLocal([]);
      return { ok: true };
    }
    return cloudWrite(() => remove(ref(db, DB_PATH)));
  }, []);

  return { scores, status, addScore, updateScore, deleteScore, clearScores };
}

/** 쓰기 실패 사유 → 안내 문구 */
export const failMessage = (reason) =>
  ({
    offline: '인터넷 연결이 끊겨 있습니다. 연결(Live 표시)을 확인한 뒤 다시 누르세요.',
    timeout: '서버 응답이 늦습니다. HQ 순위표에 기록이 들어갔는지 확인한 뒤 필요하면 다시 제출하세요.',
    denied: '저장 권한이 없습니다. Firebase 보안 규칙(README 참고)을 확인하세요.',
  })[reason] || '저장 실패 — 인터넷 연결을 확인하세요.';
