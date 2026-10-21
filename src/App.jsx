import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy, ClipboardList, Save, Download, Trash2, CheckCircle2, Clock, User, ArrowRight,
  Pencil, X, Lock, Crosshair, Target, Wifi, WifiOff, Loader2, FlaskConical, LogOut,
  AlertTriangle, Hash, Timer, Play, Square, Undo2, RotateCcw,
} from 'lucide-react';
import {
  COMPETITION, ADMIN_PASSWORD, OBSTACLES, POINTS_PER_OBSTACLE, LANDING_OPTIONS,
  DEFAULT_LANDING, TIME_BRACKETS, TIME_POINTS_INCOMPLETE, CSV_FILENAME,
} from './config';
import {
  MAX_MISSION, MAX_LANDING, MAX_TIME, MAX_TOTAL, emptyObstacles, normalizeObstacles,
  missionScoreOf, timeScoreOf, rankRows,
} from './scoring';
import { useScores } from './useScores';
import { useStopwatch, msToSeconds, formatMs, formatSeconds } from './useStopwatch';

const AUTH_KEY = 'drone_chase_auth_2026';

// 안전한 sessionStorage 접근 (사파리 비공개 모드 등에서 예외 방지)
const session = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  remove: (k) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

// =============================================================================
//  App
// =============================================================================
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => session.get(AUTH_KEY) === 'true');
  const [view, setView] = useState('landing');
  const [toast, setToast] = useState(null);
  const store = useScores();

  const notify = (message, tone = 'error') => {
    setToast({ message, tone, key: Date.now() });
  };
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!isAuthenticated) {
    return <LoginGate onLogin={() => { session.set(AUTH_KEY, 'true'); setIsAuthenticated(true); }} />;
  }

  const logout = () => { session.remove(AUTH_KEY); setIsAuthenticated(false); setView('landing'); };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header view={view} setView={setView} status={store.status} onLogout={logout} />

      {store.status === 'demo' && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-sm font-semibold px-4 py-2 text-center">
          데모 모드 — Firebase 설정(.env)이 없어 이 기기 브라우저에만 저장됩니다. 실제 대회 전 README의 Firebase 설정을 완료하세요.
        </div>
      )}
      {store.status === 'error' && (
        <div className="bg-red-100 border-b border-red-300 text-red-900 text-sm font-semibold px-4 py-2 text-center">
          클라우드 연결 오류 — 인터넷 연결과 Firebase 설정·보안 규칙을 확인하세요.
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-10 animate-fade-in" key={view}>
        {view === 'landing' && <LandingView setView={setView} count={store.scores.length} />}
        {view === 'judge' && <JudgePanel addScore={store.addScore} notify={notify} />}
        {view === 'dashboard' && <Dashboard {...store} notify={notify} />}
      </main>

      {toast && (
        <div
          key={toast.key}
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl shadow-lg font-bold text-white animate-fade-in ${
            toast.tone === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

// =============================================================================
//  Header
// =============================================================================
function Header({ view, setView, status, onLogout }) {
  const tabs = [
    { id: 'judge', label: 'Judge Panel', icon: ClipboardList, active: 'bg-emerald-600 text-white border-emerald-600' },
    { id: 'dashboard', label: 'HQ Dashboard', icon: Trophy, active: 'bg-blue-600 text-white border-blue-600' },
  ];
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <button onClick={() => setView('landing')} className="flex items-center gap-3 min-w-0" aria-label="Home">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 text-white grid place-items-center">
            <Target size={22} strokeWidth={2.5} />
          </span>
          <span className="hidden sm:block text-left leading-tight">
            <span className="block text-lg font-black tracking-tight text-slate-900">{COMPETITION.title}</span>
            <span className="block text-xs font-semibold text-slate-600">{COMPETITION.subtitle}</span>
          </span>
        </button>

        <nav className="flex items-center gap-2">
          <StatusBadge status={status} />
          {tabs.map(({ id, label, icon: Icon, active }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-current={view === id ? 'page' : undefined}
              className={`h-11 px-3 sm:px-4 flex items-center gap-2 rounded-xl border-2 font-bold transition-colors ${
                view === id ? active : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
              }`}
            >
              <Icon size={18} />
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
          <button onClick={onLogout} className="h-11 w-11 grid place-items-center rounded-xl text-slate-600 hover:bg-slate-100" title="Lock" aria-label="Lock">
            <LogOut size={18} />
          </button>
        </nav>
      </div>
    </header>
  );
}

function StatusBadge({ status }) {
  const map = {
    online: { text: 'Live', icon: Wifi, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    connecting: { text: 'Connecting', icon: Loader2, cls: 'bg-slate-50 text-slate-700 border-slate-200', spin: true },
    error: { text: 'Offline', icon: WifiOff, cls: 'bg-red-50 text-red-700 border-red-200' },
    demo: { text: 'Demo', icon: FlaskConical, cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  };
  const s = map[status] || map.connecting;
  const Icon = s.icon;
  return (
    <span className={`hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-bold ${s.cls}`}>
      <Icon size={14} className={s.spin ? 'animate-spin' : ''} />
      {s.text}
    </span>
  );
}

// =============================================================================
//  Login
// =============================================================================
function LoginGate({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) onLogin();
    else { setError(true); setPassword(''); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-8 sm:p-10 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-blue-600 text-white grid place-items-center shadow-lg shadow-blue-600/25">
          <Lock size={38} />
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{COMPETITION.title}</h1>
        <p className="mt-2 text-slate-600 font-medium">
          {COMPETITION.event}
          <br />
          <span className="text-blue-700 font-bold">{COMPETITION.subtitle}</span>
        </p>

        <form onSubmit={handleLogin} className="mt-8 space-y-4">
          <label htmlFor="pw" className="sr-only">Security Code</label>
          <input
            id="pw"
            type="password"
            inputMode="numeric"
            placeholder="Security Code"
            autoFocus
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            className={`w-full h-16 px-5 rounded-2xl border-2 text-center text-2xl font-bold tracking-[0.3em] text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal placeholder:text-lg outline-none transition-colors ${
              error ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-blue-600 bg-white'
            }`}
          />
          {error && <p className="text-red-700 font-bold">접속 코드가 올바르지 않습니다. (Invalid code)</p>}
          <button type="submit" className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-lg font-black transition">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
//  Landing
// =============================================================================
function LandingView({ setView, count }) {
  return (
    <div className="py-6 sm:py-12">
      <div className="text-center">
        <span className="inline-block px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-sm font-bold">
          {COMPETITION.event}
        </span>
        <h1 className="mt-5 text-4xl sm:text-6xl font-black tracking-tight text-slate-900">
          {COMPETITION.title} <span className="text-blue-600">{COMPETITION.year}</span>
        </h1>
        <p className="mt-4 text-lg text-slate-600 font-medium">역할을 선택하세요 · Select your role</p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
        <RoleCard
          onClick={() => setView('judge')}
          icon={ClipboardList}
          color="emerald"
          title="Judge Panel"
          ko="심판 채점"
          desc="현장 심판용 디지털 채점표 · 태블릿 최적화"
          cta="채점 시작"
        />
        <RoleCard
          onClick={() => setView('dashboard')}
          icon={Trophy}
          color="blue"
          title="HQ Dashboard"
          ko="본부 순위표"
          desc={`실시간 순위 · 수정/삭제 · CSV 저장  (현재 ${count}건)`}
          cta="순위 보기"
        />
      </div>
    </div>
  );
}

function RoleCard({ onClick, icon: Icon, color, title, ko, desc, cta }) {
  const c = {
    emerald: { icon: 'bg-emerald-600', ring: 'hover:border-emerald-500', text: 'text-emerald-700' },
    blue: { icon: 'bg-blue-600', ring: 'hover:border-blue-500', text: 'text-blue-700' },
  }[color];
  return (
    <button
      onClick={onClick}
      className={`group text-left bg-white border-2 border-slate-200 ${c.ring} rounded-3xl p-7 sm:p-8 shadow-sm hover:shadow-lg transition-all`}
    >
      <span className={`w-14 h-14 rounded-2xl ${c.icon} text-white grid place-items-center`}>
        <Icon size={28} />
      </span>
      <h2 className="mt-6 text-2xl font-black text-slate-900">
        {title} <span className="text-slate-500 font-bold text-lg">· {ko}</span>
      </h2>
      <p className="mt-2 text-slate-600 font-medium">{desc}</p>
      <span className={`mt-6 inline-flex items-center gap-2 font-black ${c.text}`}>
        {cta} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </span>
    </button>
  );
}

// =============================================================================
//  Shared score fields (Judge Panel & Edit modal)
// =============================================================================
const blankForm = () => ({ bib: '', name: '', obstacles: emptyObstacles(), landingScore: DEFAULT_LANDING, lapTime: '' });

function Section({ step, title, icon: Icon, accent, right, children }) {
  const a = {
    slate: 'border-slate-400 text-slate-800',
    emerald: 'border-emerald-500 text-emerald-800',
    violet: 'border-violet-500 text-violet-800',
    blue: 'border-blue-500 text-blue-800',
  }[accent];
  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className={`flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-l-[6px] ${a} bg-slate-50 border-b border-b-slate-200`}>
        <h3 className="flex items-center gap-2.5 text-lg font-black">
          <span className="w-7 h-7 rounded-full bg-white border-2 border-current grid place-items-center text-sm">{step}</span>
          {Icon && <Icon size={20} />}
          <span className="text-slate-900">{title}</span>
        </h3>
        {right}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function PtsTag({ children, tone }) {
  const t = {
    emerald: 'bg-emerald-100 text-emerald-800',
    violet: 'bg-violet-100 text-violet-800',
    blue: 'bg-blue-100 text-blue-800',
  }[tone];
  return <span className={`text-sm font-black px-3 py-1 rounded-lg ${t}`}>{children}</span>;
}

function ScoreFields({ form, setForm, compact = false, stopwatch }) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const toggleObstacle = (i) =>
    setForm((f) => {
      const obs = normalizeObstacles(f.obstacles);
      obs[i] = !obs[i];
      return { ...f, obstacles: obs };
    });

  const obstacles = normalizeObstacles(form.obstacles);
  const mission = missionScoreOf(obstacles);
  const inputBase = 'w-full border-2 border-slate-300 rounded-xl bg-white text-slate-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/15 transition';

  return (
    <div className="space-y-5">
      {/* 1. Participant */}
      <Section step="1" title="Participant" icon={User} accent="slate">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Bib No. · 참가번호</label>
            <div className="relative">
              <Hash size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="101"
                value={form.bib}
                onChange={(e) => set({ bib: e.target.value })}
                className={`${inputBase} h-16 pl-11 pr-4 text-3xl font-black tabular-nums`}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2">Name · 이름 / 팀명</label>
            <input
              type="text"
              placeholder="Enter name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              className={`${inputBase} h-16 px-4 text-2xl font-bold`}
            />
          </div>
        </div>
      </Section>

      {/* 2. Mission */}
      <Section
        step="2"
        title="Mission · 장애물 통과"
        icon={CheckCircle2}
        accent="emerald"
        right={<PtsTag tone="emerald">{mission} / {MAX_MISSION}</PtsTag>}
      >
        <div className={`grid gap-3 ${OBSTACLES.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {OBSTACLES.map((o, i) => {
            const on = obstacles[i];
            return (
              <button
                key={o.label}
                type="button"
                onClick={() => toggleObstacle(i)}
                aria-pressed={on}
                className={`${compact ? 'h-24' : 'h-32 sm:h-36'} rounded-2xl border-[3px] flex flex-col items-center justify-center gap-1.5 font-bold transition-all active:scale-[0.97] ${
                  on
                    ? 'bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-400'
                }`}
              >
                {on ? (
                  <CheckCircle2 size={compact ? 26 : 36} className="animate-pop" />
                ) : (
                  <span className={`${compact ? 'w-6 h-6' : 'w-9 h-9'} rounded-full border-[3px] border-dashed border-slate-400`} />
                )}
                <span className={compact ? 'text-sm' : 'text-base sm:text-lg'}>{o.label}</span>
                <span className={`text-xs font-semibold ${on ? 'text-emerald-50' : 'text-slate-500'}`}>
                  {o.sub} · +{POINTS_PER_OBSTACLE}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <div className={`grid gap-5 ${compact ? '' : 'lg:grid-cols-2'}`}>
        {/* 3. Landing */}
        <Section
          step="3"
          title="Landing · 착륙"
          icon={Crosshair}
          accent="violet"
          right={<PtsTag tone="violet">{Number(form.landingScore)} / {MAX_LANDING}</PtsTag>}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Landing score">
            {LANDING_OPTIONS.map((opt) => {
              const on = Number(form.landingScore) === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ landingScore: opt.value })}
                  className={`h-[4.5rem] rounded-xl border-2 px-2 flex flex-col items-center justify-center transition active:scale-[0.97] ${
                    on
                      ? 'bg-violet-600 border-violet-700 text-white shadow-md shadow-violet-600/25'
                      : 'bg-white border-slate-300 text-slate-800 hover:border-violet-400'
                  }`}
                >
                  <span className="text-xl font-black leading-none">{opt.value}<span className="text-xs font-bold ml-0.5">pt</span></span>
                  <span className={`mt-1 text-xs font-bold ${on ? 'text-violet-100' : 'text-slate-600'}`}>
                    {opt.label}{opt.desc ? ` · ${opt.desc}` : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* 4. Lap time */}
        <Section
          step="4"
          title="Lap Time · 기록"
          icon={Clock}
          accent="blue"
          right={
            <div className="flex items-center gap-2">
              {stopwatch && <TimerStatusChip status={stopwatch.status} />}
              <PtsTag tone="blue">{timeScoreOf(mission, form.lapTime)} / {MAX_TIME}</PtsTag>
            </div>
          }
        >
          {stopwatch && (
            <p className="mb-3 text-sm font-semibold text-slate-700">
              하단 초시계로 측정하세요. <b className="text-blue-800">STOP</b>을 누르면 기록이 자동 입력됩니다 — 필요할 때만 직접 고치세요.
              <span className="hidden lg:inline text-slate-500"> (PC: 스페이스바로 시작/정지)</span>
            </p>
          )}
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="00.00"
              value={form.lapTime}
              onChange={(e) => set({ lapTime: e.target.value })}
              className={`${inputBase} h-20 pl-5 pr-20 text-right text-4xl font-mono font-black tabular-nums`}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 font-black text-lg">sec</span>
          </div>
          <TimeRuleHint />
        </Section>
      </div>
    </div>
  );
}

function TimerStatusChip({ status }) {
  const map = {
    idle: ['bg-slate-100 text-slate-700 border-slate-300', 'Ready'],
    running: ['bg-rose-50 text-rose-700 border-rose-300 animate-pulse', 'Timing…'],
    stopped: ['bg-emerald-50 text-emerald-800 border-emerald-300', 'Recorded'],
  };
  const [cls, text] = map[status] || map.idle;
  return (
    <span className={`hidden sm:inline-flex items-center gap-1 text-xs font-black px-2.5 py-1 rounded-lg border ${cls}`}>
      <Timer size={13} /> {text}
    </span>
  );
}

/** 하단 고정 바의 초시계 — 어느 위치로 스크롤해도 바로 누를 수 있음 */
function StopwatchControl({ sw, lapTime }) {
  const running = sw.status === 'running';
  const stopped = sw.status === 'stopped';
  const box = running ? 'bg-rose-50 border-rose-300' : stopped ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-300';
  const txt = running ? 'text-rose-700' : stopped ? 'text-emerald-800' : 'text-slate-800';
  const dot = running ? 'bg-rose-500 animate-pulse' : stopped ? 'bg-emerald-500' : 'bg-slate-400';
  const btn = 'h-16 rounded-xl font-black flex items-center justify-center gap-2 transition active:scale-95';

  return (
    <div className="flex items-center gap-2">
      <div className={`h-16 px-3 sm:px-4 rounded-xl border-2 flex items-center gap-2.5 min-w-[9.5rem] sm:min-w-[11rem] ${box}`}>
        <span className={`w-3 h-3 rounded-full shrink-0 ${dot}`} />
        <div className="leading-none">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">
            {running ? 'Timing' : stopped ? 'Recorded' : 'Stopwatch'}
          </div>
          <div className={`font-mono text-2xl sm:text-3xl font-black tabular-nums ${txt}`}>
            {running ? formatMs(sw.elapsed) : stopped ? formatSeconds(lapTime) : '0:00.00'}
          </div>
        </div>
      </div>

      {sw.status === 'idle' && (
        <button type="button" onClick={sw.start} className={`${btn} flex-1 sm:flex-none sm:w-36 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-lg`}>
          <Play size={20} fill="currentColor" /> START
        </button>
      )}
      {running && (
        <button type="button" onClick={sw.stop} className={`${btn} flex-1 sm:flex-none sm:w-36 px-5 bg-rose-600 hover:bg-rose-700 text-white text-lg`}>
          <Square size={20} fill="currentColor" /> STOP
        </button>
      )}
      {stopped && (
        <>
          <button
            type="button"
            onClick={sw.undo}
            title="실수로 멈췄다면 처음 시작 시각부터 이어서 측정"
            className={`${btn} flex-1 sm:flex-none px-3 bg-white border-2 border-slate-300 text-slate-800 text-sm hover:border-slate-500`}
          >
            <Undo2 size={18} /> Undo
          </button>
          <button
            type="button"
            onClick={() => { if (window.confirm('초시계를 0:00.00으로 초기화할까요?\n(랩타임 칸의 값은 그대로 유지됩니다.)')) sw.reset(); }}
            className={`${btn} flex-1 sm:flex-none px-3 bg-white border-2 border-slate-300 text-slate-800 text-sm hover:border-slate-500`}
          >
            <RotateCcw size={18} /> Reset
          </button>
        </>
      )}
    </div>
  );
}

function TimeRuleHint() {
  return (
    <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-3 text-sm text-slate-700">
      <p className="font-bold text-blue-900 mb-1.5">Time points (auto)</p>
      <div className="flex flex-wrap gap-1.5">
        {TIME_BRACKETS.map((b, i) => (
          <span key={i} className="px-2 py-0.5 rounded-md bg-white border border-blue-200 font-semibold tabular-nums">
            {Number.isFinite(b.maxSec) ? `≤${b.maxSec}s` : `>${TIME_BRACKETS[i - 1]?.maxSec ?? 0}s`} → {b.points}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-slate-600">미션 미완료 시 {TIME_POINTS_INCOMPLETE}점 · 기록 없음(DNF) 0점</p>
    </div>
  );
}

/** 입력값 검증 — 오류 메시지 또는 null */
const validate = (form) => {
  if (!String(form.bib).trim()) return '참가번호(Bib)를 입력하세요.';
  if (!String(form.name).trim()) return '이름을 입력하세요.';
  const t = form.lapTime === '' ? 0 : Number(form.lapTime);
  if (Number.isNaN(t) || t < 0) return '랩타임은 0 이상의 숫자여야 합니다.';
  if (t > 3600) return '랩타임이 너무 큽니다. 초(sec) 단위인지 확인하세요.';
  return null;
};

// =============================================================================
//  Judge Panel
// =============================================================================
function JudgePanel({ addScore, notify }) {
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  // 초시계: 정지하면 랩타임 칸에 자동 입력 (초 단위, 소수 둘째 자리)
  const sw = useStopwatch((ms) => setForm((f) => ({ ...f, lapTime: msToSeconds(ms).toFixed(2) })));
  const swRef = useRef(sw);
  swRef.current = sw;
  const timerRunning = sw.status === 'running';

  // PC: 스페이스바로 Start/Stop (입력 칸·버튼 사용 중에는 동작 안 함)
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      const t = e.target;
      const tag = String(t?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select', 'button'].includes(tag) || t?.isContentEditable) return;
      e.preventDefault();
      swRef.current.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const mission = missionScoreOf(form.obstacles);
  const landing = Number(form.landingScore) || 0;
  const time = timeScoreOf(mission, form.lapTime);
  const total = mission + landing + time;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (timerRunning) return notify('초시계가 측정 중입니다. STOP을 누른 뒤 제출하세요.');
    const err = validate(form);
    if (err) return notify(err);

    setSaving(true);
    const ok = await addScore({ ...form, obstacles: normalizeObstacles(form.obstacles) });
    setSaving(false);
    if (!ok) return notify('전송 실패! 인터넷 연결과 Firebase 설정을 확인하세요.'); // 입력값은 그대로 유지

    setSubmitted({ bib: form.bib, name: form.name, total });
    sw.reset(); // 다음 참가자를 위해 초시계 초기화
    setTimeout(() => {
      setSubmitted(null);
      setForm(blankForm());
      window.scrollTo({ top: 0 });
    }, 1600);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <span className="w-28 h-28 rounded-full bg-emerald-500 text-white grid place-items-center shadow-xl shadow-emerald-500/30 animate-pop">
          <CheckCircle2 size={64} />
        </span>
        <h2 className="mt-6 text-4xl font-black text-slate-900">저장 완료 · Saved</h2>
        <p className="mt-3 text-xl text-slate-700 font-semibold">
          #{submitted.bib} {submitted.name} — <span className="text-emerald-700 font-black">{submitted.total} pts</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-3xl font-black text-slate-900">Official Score Sheet</h2>
          <p className="text-slate-600 font-medium mt-1">
            Total {MAX_TOTAL} = Mission {MAX_MISSION} + Landing {MAX_LANDING} + Time {MAX_TIME}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (timerRunning && !window.confirm('초시계가 측정 중입니다. 입력값과 초시계를 모두 초기화할까요?')) return;
            setForm(blankForm());
            sw.reset();
          }}
          className="h-10 px-4 rounded-lg text-slate-700 font-bold hover:bg-slate-200"
        >
          초기화 · Clear
        </button>
      </div>

      <ScoreFields form={form} setForm={setForm} stopwatch={sw} />

      {/* 하단 고정: 초시계 + 실시간 합계 + 제출 */}
      <div className="sticky bottom-3 mt-6 z-40" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="bg-white border-2 border-slate-300 rounded-2xl shadow-xl p-3 flex flex-col lg:flex-row lg:items-center gap-3">
          <StopwatchControl sw={sw} lapTime={form.lapTime} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 grid grid-cols-4 text-center">
            <Mini label="Mission" value={mission} tone="text-emerald-700" />
            <Mini label="Landing" value={landing} tone="text-violet-700" />
            <Mini label="Time" value={time} tone="text-blue-700" />
            <Mini label="Total" value={total} tone="text-slate-900" big />
          </div>
          <button
            type="submit"
            disabled={saving || timerRunning}
            title={timerRunning ? 'STOP을 먼저 누르세요' : undefined}
            className="h-16 px-5 sm:px-7 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-lg font-black flex items-center gap-2 transition active:scale-[0.98]"
          >
            {saving ? <Loader2 size={24} className="animate-spin" /> : timerRunning ? <Timer size={24} /> : <Save size={24} />}
            <span className="hidden sm:inline">{saving ? 'Saving…' : timerRunning ? 'Stop first' : 'Submit'}</span>
          </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function Mini({ label, value, tone, big }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{label}</div>
      <div className={`${big ? 'text-3xl' : 'text-2xl'} font-black tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

// =============================================================================
//  HQ Dashboard
// =============================================================================
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function Dashboard({ scores, updateScore, deleteScore, clearScores, notify }) {
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const ranked = useMemo(() => rankRows(scores), [scores]);
  const editing = editingId ? scores.find((s) => s.id === editingId) : null;

  // 수정 중인 기록이 다른 기기에서 삭제되면 모달 닫기
  useEffect(() => {
    if (editingId && !editing) setEditingId(null);
  }, [editingId, editing]);

  const filtered = query.trim()
    ? ranked.filter((r) => `${r.bib} ${r.name}`.toLowerCase().includes(query.trim().toLowerCase()))
    : ranked;

  const downloadCSV = () => {
    const header = ['Rank', 'Bib', 'Name', `Mission(${MAX_MISSION})`, `Landing(${MAX_LANDING})`, 'Lap Time(sec)', `Time Pts(${MAX_TIME})`, `Total(${MAX_TOTAL})`];
    const rows = ranked.map((s) => [s.rank, s.bib, s.name, s.missionScore, s.landingScore, s.lapTime > 0 ? s.lapTime.toFixed(2) : 'DNF', s.timeScore, s.totalScore]);
    const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = CSV_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`#${row.bib} ${row.name} 기록을 삭제할까요?`)) return;
    const ok = await deleteScore(row.id);
    notify(ok ? '삭제했습니다.' : '삭제 실패 — 연결을 확인하세요.', ok ? 'success' : 'error');
  };

  const handleClear = async () => {
    if (!scores.length) return;
    if (!window.confirm(`⚠️ 전체 ${scores.length}건의 기록을 영구 삭제합니다.\n되돌릴 수 없습니다. 계속할까요?`)) return;
    if (window.prompt('확인을 위해 RESET 을 입력하세요.') !== 'RESET') return;
    const ok = await clearScores(scores.map((s) => s.id));
    notify(ok ? '전체 기록을 삭제했습니다.' : '전체 삭제 실패 — 연결을 확인하세요.', ok ? 'success' : 'error');
  };

  const top3 = ranked.slice(0, 3);

  return (
    <div>
      {editing && (
        <EditModal
          record={editing}
          onClose={() => setEditingId(null)}
          onSave={async (rec) => {
            const ok = await updateScore(rec);
            notify(ok ? '수정했습니다.' : '수정 실패 — 연결을 확인하세요.', ok ? 'success' : 'error');
            return ok;
          }}
        />
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Trophy className="text-amber-500" size={32} /> Live Leaderboard
          </h2>
          <p className="text-slate-600 font-medium mt-1">실시간 순위 · 총 {ranked.length}명 · 만점 {MAX_TOTAL}점</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCSV} disabled={!ranked.length} className="h-12 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold flex items-center gap-2">
            <Download size={18} /> CSV 저장
          </button>
          <button onClick={handleClear} disabled={!ranked.length} className="h-12 px-5 rounded-xl bg-white border-2 border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40 font-bold flex items-center gap-2">
            <Trash2 size={18} /> 전체 삭제
          </button>
        </div>
      </div>

      {/* Podium */}
      {top3.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          {top3.map((r) => (
            <PodiumCard key={r.id} row={r} />
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <input
            type="search"
            placeholder="참가번호·이름 검색 (Search bib / name)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:max-w-sm h-11 px-4 rounded-lg border-2 border-slate-300 bg-white outline-none focus:border-blue-600 font-medium"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[760px]">
            <thead className="bg-slate-100 text-slate-700 text-sm font-black">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Bib</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4 text-center">Mission <span className="font-semibold text-slate-500">/{MAX_MISSION}</span></th>
                <th className="py-3 px-4 text-center">Landing <span className="font-semibold text-slate-500">/{MAX_LANDING}</span></th>
                <th className="py-3 px-4 text-right">Lap (s)</th>
                <th className="py-3 px-4 text-center">Time <span className="font-semibold text-slate-500">/{MAX_TIME}</span></th>
                <th className="py-3 px-4 text-center bg-slate-200">Total <span className="font-semibold text-slate-500">/{MAX_TOTAL}</span></th>
                <th className="py-3 px-4 text-center">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-slate-600 font-medium">
                    {ranked.length === 0 ? '아직 기록이 없습니다. Judge Panel에서 점수를 제출하세요.' : '검색 결과가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className={`border-t border-slate-200 ${rowTint(row.rank)}`}>
                    <td className="py-3 px-4"><RankBadge rank={row.rank} /></td>
                    <td className="py-3 px-4 font-black text-slate-800 text-lg tabular-nums">{row.bib}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 text-lg">{row.name}</td>
                    <td className="py-3 px-4 text-center"><Chip tone="emerald">{row.missionScore}</Chip></td>
                    <td className="py-3 px-4 text-center"><Chip tone="violet">{row.landingScore}</Chip></td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 text-lg tabular-nums">
                      {row.lapTime > 0 ? row.lapTime.toFixed(2) : <span className="text-red-600">DNF</span>}
                    </td>
                    <td className="py-3 px-4 text-center"><Chip tone="blue">{row.timeScore}</Chip></td>
                    <td className="py-3 px-4 text-center bg-slate-50">
                      <span className="text-3xl font-black text-slate-900 tabular-nums">{row.totalScore}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setEditingId(row.id)} className="w-10 h-10 grid place-items-center rounded-lg border-2 border-slate-200 text-slate-700 hover:border-blue-500 hover:text-blue-700" aria-label="Edit">
                          <Pencil size={17} />
                        </button>
                        <button onClick={() => handleDelete(row)} className="w-10 h-10 grid place-items-center rounded-lg border-2 border-slate-200 text-slate-700 hover:border-red-500 hover:text-red-700" aria-label="Delete">
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const rowTint = (rank) =>
  rank === 1 ? 'bg-amber-50' : rank === 2 ? 'bg-slate-50' : rank === 3 ? 'bg-orange-50' : 'hover:bg-slate-50';

function RankBadge({ rank }) {
  const cls =
    rank === 1 ? 'bg-amber-400 text-amber-950'
      : rank === 2 ? 'bg-slate-300 text-slate-900'
        : rank === 3 ? 'bg-orange-300 text-orange-950'
          : 'bg-white border-2 border-slate-200 text-slate-700';
  return <span className={`inline-grid place-items-center w-10 h-10 rounded-full font-black text-lg ${cls}`}>{rank}</span>;
}

function Chip({ children, tone }) {
  const t = { emerald: 'bg-emerald-100 text-emerald-800', violet: 'bg-violet-100 text-violet-800', blue: 'bg-blue-100 text-blue-800' }[tone];
  return <span className={`inline-block min-w-[2.75rem] px-3 py-1 rounded-lg font-black tabular-nums ${t}`}>{children}</span>;
}

function PodiumCard({ row }) {
  const style = {
    1: { bar: 'bg-amber-400', label: '1st', medal: '🥇' },
    2: { bar: 'bg-slate-400', label: '2nd', medal: '🥈' },
    3: { bar: 'bg-orange-400', label: '3rd', medal: '🥉' },
  }[row.rank] || { bar: 'bg-slate-300', label: `${row.rank}`, medal: '' };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className={`h-2 ${style.bar}`} />
      <div className="p-5 flex items-center gap-4">
        <span className="text-4xl" aria-hidden>{style.medal}</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase text-slate-600">{style.label} · #{row.bib}</div>
          <div className="text-xl font-black text-slate-900 truncate">{row.name}</div>
          <div className="text-sm font-semibold text-slate-600 tabular-nums">{row.lapTime > 0 ? `${row.lapTime.toFixed(2)} s` : 'DNF'}</div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-slate-900 tabular-nums">{row.totalScore}</div>
          <div className="text-xs font-bold text-slate-600">pts</div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
//  Edit Modal
// =============================================================================
function EditModal({ record, onClose, onSave }) {
  // 원본 코드는 state 객체를 직접 변경(mutate)했고, obstacles 가 없으면 오류가 났음 → 정규화한 복사본 사용
  const [form, setForm] = useState(() => ({
    ...record,
    obstacles: normalizeObstacles(record.obstacles),
    lapTime: record.lapTime ? String(record.lapTime) : '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    const err = validate(form);
    if (err) return setError(err);
    setSaving(true);
    const ok = await onSave({ ...form, id: record.id });
    setSaving(false);
    if (ok) onClose();
  };

  const total = (() => {
    const m = missionScoreOf(form.obstacles);
    return m + (Number(form.landingScore) || 0) + timeScoreOf(m, form.lapTime);
  })();

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit record"
        className="bg-slate-50 w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2"><Pencil size={20} className="text-blue-600" /> 기록 수정 · Edit</h3>
          <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full hover:bg-slate-100 text-slate-700" aria-label="Close"><X size={22} /></button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto">
          <ScoreFields form={form} setForm={setForm} compact />
          {error && (
            <p className="mt-4 flex items-center gap-2 text-red-700 font-bold"><AlertTriangle size={18} /> {error}</p>
          )}
        </div>

        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between gap-3">
          <span className="font-bold text-slate-700">Total <span className="text-2xl font-black text-slate-900 tabular-nums ml-1">{total}</span></span>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-12 px-5 rounded-xl font-bold text-slate-700 hover:bg-slate-100">취소</button>
            <button onClick={handleSave} disabled={saving} className="h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-black flex items-center gap-2">
              {saving && <Loader2 size={18} className="animate-spin" />} 저장 · Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
