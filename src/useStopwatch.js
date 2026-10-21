import { useEffect, useRef, useState } from 'react';

// =============================================================================
//  초시계 (idrcc-scoring 과 같은 방식)
//  - 시작 시각을 기준으로 계산 → 화면 꺼짐·탭 전환·새로고침에도 정확
//  - 상태(idle | running | stopped)를 기기에 저장 → 새로고침해도 이어짐
//  - 측정 중 화면 꺼짐 방지(Wake Lock), 시작/정지 시 진동(지원 기기)
// =============================================================================

const SW_KEY = 'drone_chase_stopwatch';
const MAX_MS = 59 * 60 * 1000 + 59 * 1000 + 990; // 59:59.99

const storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  remove: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/** 밀리초 → 초(소수 둘째 자리, 1/100초 미만 버림) */
export const msToSeconds = (ms) => Math.floor(Math.min(Math.max(0, ms), MAX_MS) / 10) / 100;

/** 밀리초 → "0:00.00" 표시 */
export const formatMs = (ms) => {
  const cs = Math.floor(Math.min(Math.max(0, ms), MAX_MS) / 10);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
};

/** 초 → "0:00.00" 표시 (랩타임 칸 값 표시용) */
export const formatSeconds = (sec) => {
  const t = Number(sec);
  return t > 0 ? formatMs(Math.round(t * 1000)) : '0:00.00';
};

function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* unsupported */ }
}

/**
 * @param {(ms:number) => void} onStop 정지 시 호출 (랩타임 칸 자동 입력용)
 */
export function useStopwatch(onStop) {
  const [sw, setSw] = useState(() => {
    try {
      const s = JSON.parse(storage.get(SW_KEY) || 'null');
      if (s && (s.status === 'running' || s.status === 'stopped') && Number(s.startAt) > 0) return s;
    } catch { /* corrupt state */ }
    return { status: 'idle', startAt: 0, elapsed: 0 };
  });
  const [now, setNow] = useState(() => Date.now());
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  // 상태 저장
  useEffect(() => {
    if (sw.status === 'idle') storage.remove(SW_KEY);
    else storage.set(SW_KEY, JSON.stringify(sw));
  }, [sw]);

  // 새로고침 직후 '정지' 상태였다면 기록을 폼에 다시 채움
  useEffect(() => {
    if (sw.status === 'stopped') onStopRef.current?.(sw.elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 측정 중: 화면 갱신 + 화면 꺼짐 방지
  useEffect(() => {
    if (sw.status !== 'running') return undefined;
    const id = setInterval(() => setNow(Date.now()), 31);
    let lock = null;
    let done = false;
    const acquire = async () => {
      try {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
        const l = await navigator.wakeLock.request('screen');
        if (done) l.release(); else lock = l;
      } catch { /* unsupported or denied */ }
    };
    const onVis = () => {
      setNow(Date.now());
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      done = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      try { if (lock) lock.release(); } catch { /* already released */ }
    };
  }, [sw.status]);

  const elapsed = sw.status === 'running' ? Math.max(0, now - sw.startAt) : sw.elapsed;

  const start = () => {
    const t = Date.now();
    setNow(t);
    setSw({ status: 'running', startAt: t, elapsed: 0 });
    buzz(40);
  };
  const stop = () => {
    if (sw.status !== 'running') return;
    const e = Math.max(0, Date.now() - sw.startAt);
    setSw({ status: 'stopped', startAt: sw.startAt, elapsed: e });
    onStopRef.current?.(e);
    buzz([40, 60, 40]);
  };
  /** 실수로 멈춘 경우: 처음 시작 시각 기준으로 측정을 이어감 */
  const undo = () => {
    if (sw.status !== 'stopped') return;
    setNow(Date.now());
    setSw({ ...sw, status: 'running' });
    buzz(40);
  };
  const reset = () => setSw({ status: 'idle', startAt: 0, elapsed: 0 });
  const toggle = () => {
    if (sw.status === 'idle') start();
    else if (sw.status === 'running') stop();
  };

  return { status: sw.status, elapsed, start, stop, undo, reset, toggle };
}
