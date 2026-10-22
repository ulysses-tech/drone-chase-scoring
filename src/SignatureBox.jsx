import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { PenLine, RotateCcw } from 'lucide-react';

/**
 * 학생 서명 패드 (idrcc-scoring 과 같은 방식)
 * - 화면 회전·크기 변경 시에도 그린 서명이 유지됨
 * - ref 로 isEmpty() / toDataURL() / clear() 사용
 * - onChange(hasInk) 로 서명 여부를 부모에 알림
 */
const SignatureBox = forwardRef(function SignatureBox({ height = 240, onChange, invalid = false }, outerRef) {
  const padRef = useRef(null);
  const boxRef = useRef(null);
  const widthRef = useRef(0);
  const strokesRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [hasInk, setHasInk] = useState(false);

  const setInk = useCallback((v) => {
    setHasInk(v);
    onChange?.(v);
  }, [onChange]);

  const clearPad = useCallback(() => {
    padRef.current?.clear();
    strokesRef.current = null;
    setInk(false);
  }, [setInk]);

  useImperativeHandle(outerRef, () => ({
    isEmpty: () => !padRef.current || padRef.current.isEmpty(),
    toDataURL: () => padRef.current.toDataURL('image/png'),
    clear: clearPad,
  }), [clearPad]);

  // 칸 너비에 맞춰 캔버스 크기 조정 (그린 선은 보존)
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      if (!w || w === widthRef.current) return;
      if (padRef.current && !padRef.current.isEmpty()) strokesRef.current = padRef.current.toData();
      widthRef.current = w;
      setWidth(w);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el); else window.addEventListener('resize', measure);
    return () => { if (ro) ro.disconnect(); else window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => {
    if (padRef.current && width && strokesRef.current?.length) {
      padRef.current.fromData(strokesRef.current);
      strokesRef.current = null;
    }
  }, [width]);

  return (
    <div>
      <div
        ref={boxRef}
        className={`relative w-full rounded-2xl border-[3px] border-dashed overflow-hidden touch-none bg-white transition-colors ${
          invalid ? 'border-red-500 bg-red-50' : hasInk ? 'border-emerald-500' : 'border-slate-400'
        }`}
        style={{ height }}
      >
        {/* 서명 기준선 */}
        <div className="absolute left-6 right-6 bottom-12 border-b-2 border-slate-300 pointer-events-none" />
        <span className="absolute left-6 bottom-14 text-2xl font-black text-slate-300 pointer-events-none">✕</span>
        {!hasInk && (
          <div className="absolute inset-0 grid place-items-center text-slate-500 pointer-events-none">
            <div className="flex flex-col items-center gap-1.5">
              <PenLine size={32} />
              <span className="text-lg font-bold">여기에 학생이 서명하세요</span>
              <span className="text-sm font-semibold text-slate-400">Participant signs here</span>
            </div>
          </div>
        )}
        {width > 0 && (
          <div className="relative z-10">
            <SignatureCanvas
              ref={padRef}
              penColor="#0f172a"
              minWidth={1.4}
              maxWidth={3.2}
              clearOnResize={false}
              onBegin={() => setInk(true)}
              canvasProps={{ width, height, className: 'block cursor-crosshair', 'aria-label': 'Signature pad' }}
            />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clearPad}
        className="mt-2 h-10 px-3 -ml-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-red-50 hover:text-red-700"
      >
        <RotateCcw size={16} /> 서명 지우기 · Clear
      </button>
    </div>
  );
});

export default SignatureBox;
