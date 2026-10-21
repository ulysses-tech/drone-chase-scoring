import { useEffect, useState, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch,
} from 'firebase/firestore';
import { COLLECTION_NAME } from './config';

// -----------------------------------------------------------------------------
//  Firebase 설정은 코드에 직접 쓰지 않고 .env 파일에서 읽습니다. (README 참고)
//  .env 값이 비어 있으면 '데모 모드'로 동작합니다 — 이 기기 브라우저에만 저장.
// -----------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isCloudMode = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let db = null;
if (isCloudMode) {
  db = getFirestore(initializeApp(firebaseConfig));
}

// 저장할 필드만 골라냄 (id·계산값이 문서에 섞여 들어가지 않도록)
const pickFields = (r) => ({
  bib: String(r.bib ?? '').trim(),
  name: String(r.name ?? '').trim(),
  obstacles: Array.isArray(r.obstacles) ? r.obstacles.map(Boolean) : [],
  landingScore: Number(r.landingScore) || 0,
  lapTime: Number(r.lapTime) || 0,
});

// ── 데모 모드 저장소 (localStorage) ─────────────────────────────────────
const LOCAL_KEY = `demo_${COLLECTION_NAME}`;
const readLocal = () => {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
};
const writeLocal = (rows) => {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows)); } catch { /* 저장 불가 환경 */ }
  window.dispatchEvent(new Event('local-scores-changed'));
};

/**
 * 점수 데이터 훅.
 * 모든 쓰기 함수는 성공 시 true, 실패 시 false 를 돌려줍니다.
 */
export function useScores() {
  const [scores, setScores] = useState([]);
  const [status, setStatus] = useState(isCloudMode ? 'connecting' : 'demo'); // connecting | online | error | demo

  useEffect(() => {
    if (!isCloudMode) {
      const sync = () => setScores(readLocal());
      sync();
      window.addEventListener('local-scores-changed', sync);
      window.addEventListener('storage', sync); // 다른 탭과 동기화
      return () => {
        window.removeEventListener('local-scores-changed', sync);
        window.removeEventListener('storage', sync);
      };
    }
    const unsubscribe = onSnapshot(
      collection(db, COLLECTION_NAME),
      (snap) => {
        setScores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStatus('online');
      },
      (err) => {
        console.error('Firebase sync error:', err);
        setStatus('error');
      }
    );
    return () => unsubscribe();
  }, []);

  const addScore = useCallback(async (record) => {
    const data = { ...pickFields(record), timestamp: Date.now() };
    try {
      if (!isCloudMode) {
        writeLocal([...readLocal(), { id: crypto.randomUUID?.() || String(Date.now()), ...data }]);
      } else {
        await addDoc(collection(db, COLLECTION_NAME), data);
      }
      return true;
    } catch (e) {
      console.error('Add failed:', e);
      return false;
    }
  }, []);

  const updateScore = useCallback(async (record) => {
    const data = { ...pickFields(record), updatedAt: Date.now() };
    try {
      if (!isCloudMode) {
        writeLocal(readLocal().map((r) => (r.id === record.id ? { ...r, ...data } : r)));
      } else {
        await updateDoc(doc(db, COLLECTION_NAME, record.id), data);
      }
      return true;
    } catch (e) {
      console.error('Update failed:', e);
      return false;
    }
  }, []);

  const deleteScore = useCallback(async (id) => {
    try {
      if (!isCloudMode) {
        writeLocal(readLocal().filter((r) => r.id !== id));
      } else {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
      }
      return true;
    } catch (e) {
      console.error('Delete failed:', e);
      return false;
    }
  }, []);

  // 전체 삭제 — 원본 코드의 forEach(async) 는 오류를 잡지 못하고 완료를 기다리지도 않았음
  const clearScores = useCallback(async (ids) => {
    try {
      if (!isCloudMode) {
        writeLocal([]);
        return true;
      }
      // Firestore 배치는 최대 500건 → 나눠서 처리
      for (let i = 0; i < ids.length; i += 450) {
        const batch = writeBatch(db);
        ids.slice(i, i + 450).forEach((id) => batch.delete(doc(db, COLLECTION_NAME, id)));
        await batch.commit();
      }
      return true;
    } catch (e) {
      console.error('Clear failed:', e);
      return false;
    }
  }, []);

  return { scores, status, addScore, updateScore, deleteScore, clearScores };
}
