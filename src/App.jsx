import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy, ClipboardList, Save, Download, Trash2, CheckCircle2, Clock, User, ArrowRight,
  Pencil, X, Lock, Crosshair, Target, Wifi, WifiOff, Loader2, FlaskConical, LogOut,
  AlertTriangle, Hash, Timer, Play, Square, Undo2, RotateCcw, PenLine, Ban,
} from 'lucide-react';
import {
  COMPETITION, ADMIN_PASSWORD, HQ_PASSWORD, OBSTACLES, POINTS_PER_OBSTACLE, LANDING_OPTIONS,
  DEFAULT_LANDING, TIME_BRACKETS, TIME_POINTS_INCOMPLETE, RESULT_FILENAME, DIVISIONS, ROUNDS,
} from './config';
import { roundOf, roundInfo, bestPerPerson } from './rounds';
import { divisionInfo, groupByDivision } from './divisions';
import { exportResults } from './exportResults';
import {
  MAX_MISSION, MAX_LANDING, MAX_TIME, MAX_TOTAL, emptyObstacles, normalizeObstacles,
  missionScoreOf, timeScoreOf, rankRows,
} from './scoring';
import { useScores, failMessage } from './useScores';
import { useStopwatch, msToSeconds, formatMs, formatSeconds } from './useStopwatch';
import SignatureBox from './SignatureBox';
import { RosterPicker, RosterManager, DEVICE_ID, claimedByOther, profileLine, personKey, DivisionBadge } from './Roster';

const AUTH_KEY = 'drone_chase_auth_2026';
const HQ_KEY = 'drone_chase_hq_2026';

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
  const [hqAuth, setHqAuth] = useState(() => session.get(HQ_KEY) === 'true');
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

  const logout = () => {
    session.remove(AUTH_KEY);
    session.remove(HQ_KEY);
    setIsAuthenticated(false);
    setHqAuth(false);
    setView('landing');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <Header view={view} setView={setView} status={store.status} onLogout={logout} />

      {store.status === 'demo' && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-sm font-semibold px-4 py-2 text-center">
          데모 모드 — Firebase 설정(src/firebaseConfig.js)이 없어 이 기기 브라우저에만 저장됩니다.
        </div>
      )}
      {store.status === 'offline' && (
        <div className="bg-red-100 border-b border-red-300 text-red-900 text-sm font-semibold px-4 py-2 text-center">
          인터넷 연결이 끊겼습니다 — 연결되면 자동으로 다시 동기화됩니다. 그동안 제출은 잠시 막힙니다.
        </div>
      )}
      {store.status === 'error' && (
        <div className="bg-red-100 border-b border-red-300 text-red-900 text-sm font-semibold px-4 py-2 text-center">
          데이터베이스에 접근할 수 없습니다 — Firebase 보안 규칙(README 참고)을 확인하세요.
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-10 animate-fade-in" key={view}>
        {view === 'landing' && <LandingView setView={setView} count={store.scores.length} />}
        {view === 'judge' && (
          <JudgePanel
            addScore={store.addScore}
            notify={notify}
            roster={store.roster}
            claims={store.claims}
            scores={store.scores}
            claimParticipant={store.claimParticipant}
            releaseParticipant={store.releaseParticipant}
          />
        )}
        {view === 'dashboard' && (hqAuth ? (
          <Dashboard {...store} notify={notify} />
        ) : (
          <HqGate
            onUnlock={() => { session.set(HQ_KEY, 'true'); setHqAuth(true); }}
            onCancel={() => setView('landing')}
          />
        ))}
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
    offline: { text: 'Offline', icon: WifiOff, cls: 'bg-red-50 text-red-700 border-red-200' },
    error: { text: 'Error', icon: WifiOff, cls: 'bg-red-50 text-red-700 border-red-200' },
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
// =============================================================================
//  HQ Dashboard 비밀번호 확인
// =============================================================================
function HqGate({ onUnlock, onCancel }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (password === HQ_PASSWORD) onUnlock();
    else { setError(true); setPassword(''); }
  };

  return (
    <div className="flex justify-center py-6 sm:py-12">
      <form onSubmit={submit} className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-blue-600 text-white grid place-items-center">
          <Trophy size={30} />
        </div>
        <h2 className="text-2xl font-black text-slate-900">HQ Dashboard</h2>
        <p className="mt-2 text-slate-600 font-medium">본부 전용입니다. HQ 비밀번호를 입력하세요.</p>

        <label htmlFor="hq-pw" className="sr-only">HQ password</label>
        <input
          id="hq-pw"
          type="password"
          placeholder="HQ password"
          autoFocus
          autoComplete="off"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          className={`mt-6 w-full h-14 px-5 rounded-2xl border-2 text-center text-xl font-bold text-slate-900 placeholder:text-slate-400 placeholder:text-base outline-none transition-colors ${
            error ? 'border-red-500 bg-red-50' : 'border-slate-300 focus:border-blue-600 bg-white'
          }`}
        />
        {error && <p className="mt-3 text-red-700 font-bold">HQ 비밀번호가 올바르지 않습니다.</p>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onCancel} className="h-14 rounded-2xl border-2 border-slate-300 text-slate-700 font-bold hover:bg-slate-50">
            취소
          </button>
          <button type="submit" className="h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black">
            입장
          </button>
        </div>
      </form>
    </div>
  );
}

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
          desc={`실시간 순위 · 수정/삭제 · 결과 엑셀 저장  (현재 ${count}건)`}
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
const blankForm = () => ({
  bib: '', name: '', division: '', country: '', affiliation: '', grade: '', gender: '',
  obstacles: emptyObstacles(), landingScore: DEFAULT_LANDING, lapTime: '', dq: false,
});

const localPref = {
  get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

function Section({ step, title, icon: Icon, accent, right, children }) {
  const a = {
    slate: 'border-slate-400 text-slate-800',
    emerald: 'border-emerald-500 text-emerald-800',
    violet: 'border-violet-500 text-violet-800',
    blue: 'border-blue-500 text-blue-800',
    red: 'border-red-500 text-red-800',
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

function ScoreFields({ form, setForm, compact = false, stopwatch, afterParticipant }) {
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
          {DIVISIONS.length > 0 && (
            <div className="sm:col-span-3">
              <span className="block text-sm font-bold text-slate-700 mb-2">Division · 부문 (시상 구분)</span>
              <div className={`grid gap-2 grid-cols-2 ${DIVISIONS.length >= 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`} role="radiogroup" aria-label="Division">
                {DIVISIONS.map((d) => {
                  const on = form.division === d.key;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ division: d.key })}
                      className={`${compact ? 'h-12' : 'h-14'} rounded-xl border-2 font-black text-lg transition active:scale-[0.97] ${
                        on ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500'
                      }`}
                    >
                      {d.label}
                      <span className={`ml-1.5 text-xs font-bold ${on ? 'text-slate-300' : 'text-slate-500'}`}>{d.en}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* 1번과 2번 사이 (Judge Panel 에서만 전달됨) */}
      {afterParticipant}

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

/**
 * 경기 시작 준비 알림 — 이름이 입력되면 나타나 깜빡이고,
 * 심판이 '확인' 칸을 눌러야 깜빡임이 멈춤 (초시계 없이 경기를 시작하는 것을 방지)
 */
function ReadyAlert({ acknowledged, onAcknowledge }) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 px-5 sm:px-6 py-4 transition-colors ${
        acknowledged ? 'bg-emerald-50 border-emerald-300' : 'bg-red-50 border-red-400'
      }`}
    >
      <p className={`text-lg font-black leading-snug ${acknowledged ? 'text-emerald-800' : 'text-red-600 animate-blink'}`}>
        ※ 학생의 경기 시작 준비가 완료되었습니다. 심판은 초시계를 준비하세요!
      </p>
      <button
        type="button"
        onClick={onAcknowledge}
        disabled={acknowledged}
        aria-pressed={acknowledged}
        className={`shrink-0 h-12 px-4 rounded-xl border-2 font-black flex items-center gap-2 transition active:scale-95 ${
          acknowledged
            ? 'bg-emerald-600 border-emerald-600 text-white cursor-default'
            : 'bg-white border-red-500 text-red-600 hover:bg-red-100'
        }`}
      >
        {acknowledged ? <CheckCircle2 size={20} /> : <span className="w-5 h-5 rounded-md border-2 border-red-500" />}
        {acknowledged ? '확인 완료' : '확인'}
      </button>
    </div>
  );
}

/** 초시계를 쓰지 않고 제출할 때 띄우는 확인 창 */
function NoTimerDialog({ lapTime, onBack, onSubmitAnyway }) {
  const hasTime = Number(lapTime) > 0;
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onBack();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onBack}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="no-timer-title"
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-red-600 text-white px-6 py-5 flex items-center gap-3">
          <AlertTriangle size={28} className="shrink-0" />
          <h3 id="no-timer-title" className="text-xl font-black">초시계로 측정하지 않았습니다</h3>
        </div>
        <div className="px-6 py-5 text-slate-800 font-semibold leading-relaxed">
          {hasTime ? (
            <p>
              랩타임 <b className="font-mono text-red-700">{Number(lapTime).toFixed(2)}초</b>가 직접 입력되어 있습니다.
              <br />초시계(START → STOP)로 잰 기록이 아닙니다.
            </p>
          ) : (
            <p>
              랩타임이 비어 있어 <b className="text-red-700">기록 없음(DNF)</b>으로 저장됩니다.
              <br />초시계를 시작하지 않았습니다.
            </p>
          )}
          <p className="mt-3 text-slate-600">그래도 제출할까요?</p>
        </div>
        <div className="px-6 pb-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onBack} autoFocus className="h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black">
            돌아가기
          </button>
          <button type="button" onClick={onSubmitAnyway} className="h-14 rounded-2xl border-2 border-red-400 text-red-700 hover:bg-red-50 font-black">
            그래도 제출
          </button>
        </div>
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
function StopwatchControl({ sw, lapTime, highlightStart = false }) {
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
        <button
          type="button"
          onClick={sw.start}
          className={`${btn} flex-1 sm:flex-none sm:w-36 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-lg ${
            highlightStart ? 'animate-blink ring-4 ring-red-500 ring-offset-2' : ''
          }`}
        >
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
  if (DIVISIONS.length && !DIVISIONS.some((d) => d.key === form.division)) return `부문(${DIVISIONS.map((d) => d.label).join('·')})을 선택하세요.`;
  const t = form.lapTime === '' ? 0 : Number(form.lapTime);
  if (Number.isNaN(t) || t < 0) return '랩타임은 0 이상의 숫자여야 합니다.';
  if (t > 3600) return '랩타임이 너무 큽니다. 초(sec) 단위인지 확인하세요.';
  return null;
};

// =============================================================================
//  Judge Panel
// =============================================================================
function JudgePanel({ addScore, notify, roster = [], claims = {}, scores = [], claimParticipant, releaseParticipant }) {
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  // ── 참가자 명단 연동 ──────────────────────────────────────────────
  const [judgeName, setJudgeNameState] = useState(() => localPref.get('drone_chase_judge_name'));
  const setJudgeName = (v) => { setJudgeNameState(v); localPref.set('drone_chase_judge_name', v); };
  const [group, setGroupState] = useState(() => localPref.get('drone_chase_group'));
  // 차수(1차·2차): 기기에 기억 — 보통 1차를 모두 마친 뒤 2차로 바꿈
  const [round, setRoundState] = useState(() => {
    const v = localPref.get('drone_chase_round');
    return ROUNDS.some((r) => r.key === v) ? v : ROUNDS[0].key;
  });
  const setRound = (v) => { setRoundState(v); localPref.set('drone_chase_round', v); };
  const setGroup = (v) => { setGroupState(v); localPref.set('drone_chase_group', v); };
  const [selectedId, setSelectedId] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const selectedEntry = roster.find((r) => r.id === selectedId) || null;

  // 다른 화면으로 나가면 '채점 중' 표시 해제
  const selectedIdRef = useRef(null);
  selectedIdRef.current = selectedId;
  useEffect(() => () => { if (selectedIdRef.current) releaseParticipant?.(selectedIdRef.current); }, [releaseParticipant]);

  // 선택한 참가자의 번호·이름을 직접 고치면 명단 연결을 끊음 (명단에 없는 참가자로 취급)
  useEffect(() => {
    if (!selectedEntry) return;
    if (String(form.bib).trim() !== String(selectedEntry.bib) || String(form.name).trim() !== String(selectedEntry.name)) {
      releaseParticipant?.(selectedEntry.id);
      setSelectedId(null);
      setForm((f) => ({ ...f, division: '', country: '', affiliation: '', grade: '', gender: '' }));
    }
  }, [form.bib, form.name, selectedEntry, releaseParticipant]);

  // 경기 시작 준비 알림: 이름이 입력되면 깜빡이고, '확인'을 눌러야 멈춤.
  // 이름이 지워지면(초기화·제출 후 포함) 다시 처음 상태로 돌아감
  const hasName = String(form.name).trim() !== '';
  const [readyAck, setReadyAck] = useState(false);
  useEffect(() => {
    if (!hasName) setReadyAck(false);
  }, [hasName]);

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

  // 초시계를 쓰지 않고 제출하려 할 때 확인 창
  const [confirmNoTimer, setConfirmNoTimer] = useState(false);

  // 학생 서명 (필수)
  const sigRef = useRef(null);
  const sigSectionRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [sigMissing, setSigMissing] = useState(false);

  /** 명단에서 참가자 선택 → 번호·이름·정보 자동 입력 + 다른 심판에게 '채점 중' 표시 */
  const selectParticipant = async (entry) => {
    if (selecting) return;
    if (!String(judgeName).trim()) return notify('심판 이름을 먼저 입력하세요. (여러 심판이 같은 참가자를 고르지 않도록 표시됩니다)');
    if (timerRunning) return notify('초시계 측정 중에는 참가자를 바꿀 수 없습니다. STOP을 먼저 누르세요.');
    const claim = claims[entry.id];
    if (claimedByOther(claim) && !window.confirm(`${claim.judge || '다른'} 심판이 이 참가자를 채점 중입니다.\n그래도 선택할까요?`)) return;
    if (scores.some((s) => personKey(s) === personKey(entry) && roundOf(s) === round) && !window.confirm(`#${entry.bib} ${entry.name} 은(는) 이미 ${roundInfo(round).label} 채점이 완료된 참가자입니다.\n다시 채점할까요?`)) return;
    const dirty = form.bib || form.name || form.lapTime || form.obstacles.some(Boolean) || sw.status !== 'idle' || hasSignature;
    if (dirty && !window.confirm('지금 입력 중인 내용(점수·초시계·서명)이 지워집니다. 참가자를 바꿀까요?')) return;

    setSelecting(true);
    const res = await claimParticipant(entry.id, judgeName, DEVICE_ID);
    setSelecting(false);
    if (!res.ok) return notify(failMessage(res.reason));
    if (selectedId && selectedId !== entry.id) releaseParticipant(selectedId);

    sw.reset();
    sigRef.current?.clear();
    setSigMissing(false);
    setSelectedId(entry.id);
    setForm({
      ...blankForm(),
      bib: String(entry.bib), name: String(entry.name),
      division: entry.division || '', country: entry.country || '', affiliation: entry.affiliation || '', grade: entry.grade || '', gender: entry.gender || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** 실격: 초시계를 멈추고 그 시간까지의 기록·점수로 저장 (결과표에 실격 표시) */
  const disqualify = () => {
    if (form.dq) return;
    if (!String(form.bib).trim() && !String(form.name).trim()) return notify('참가자를 먼저 입력하거나 명단에서 선택하세요.');
    const who = `#${form.bib} ${form.name}`.trim();
    if (!window.confirm(`${who} 을(를) 실격 처리할까요?\n\n초시계가 멈추고 지금까지의 시간이 자동으로 기록됩니다.\n점수는 지금까지 입력한 점수로 저장되며, 결과표에 '실격'으로 표시됩니다.`)) return;
    if (sw.status === 'running') sw.stop(); // 정지 → 랩타임 칸 자동 입력
    setForm((f) => ({ ...f, dq: true }));
    notify('실격 처리했습니다. 학생 서명을 받은 뒤 제출하세요.', 'success');
    setTimeout(() => sigSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  };
  const cancelDq = () => {
    if (!window.confirm('실격을 취소할까요? (초시계 기록은 그대로 둡니다)')) return;
    setForm((f) => ({ ...f, dq: false }));
  };

  const handleSubmit = async (e, { skipTimerCheck = false } = {}) => {
    e?.preventDefault();
    if (saving) return;
    if (timerRunning) return notify('초시계가 측정 중입니다. STOP을 누른 뒤 제출하세요.');
    const err = validate(form);
    if (err) return notify(err);
    // 학생 서명이 없으면 제출 불가
    if (!sigRef.current || sigRef.current.isEmpty()) {
      setSigMissing(true);
      sigSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return notify('학생 서명이 필요합니다. 서명 칸에 서명을 받은 뒤 제출하세요.');
    }
    // 이 참가자에 대해 초시계를 START→STOP 하지 않았다면 한 번 더 확인
    if (!skipTimerCheck && !form.dq && sw.status !== 'stopped') return setConfirmNoTimer(true);
    setConfirmNoTimer(false);
    // 같은 참가자의 같은 차수 기록이 이미 있으면 확인
    const dup = scores.find((s) => personKey(s) === personKey(form) && roundOf(s) === round);
    if (dup && !window.confirm(`#${form.bib} ${form.name} 의 ${roundInfo(round).label} 기록이 이미 있습니다.\n그래도 제출할까요? (HQ에서 하나를 지워야 할 수 있습니다)`)) return;

    setSaving(true);
    const res = await addScore({
      ...form,
      round,
      judge: judgeName,
      rosterId: selectedId || undefined,
      obstacles: normalizeObstacles(form.obstacles),
      signature: sigRef.current.toDataURL(),
    });
    setSaving(false);
    if (!res.ok) return notify(failMessage(res.reason)); // 입력값은 그대로 유지

    setSubmitted({ bib: form.bib, name: form.name, total, round, dq: form.dq });
    sw.reset(); // 다음 참가자를 위해 초시계 초기화
    setHasSignature(false); // 서명 칸은 완료 화면 뒤 새로 열림
    setSigMissing(false);
    if (selectedId) releaseParticipant(selectedId); // 채점 완료 → '채점 중' 표시 해제
    setSelectedId(null);
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
          <span className="font-black text-blue-700">{roundInfo(submitted.round).label}</span> · #{submitted.bib} {submitted.name} — <span className="text-emerald-700 font-black">{submitted.total} pts</span>
          {submitted.dq && <span className="ml-2 inline-block px-2.5 py-0.5 rounded-lg bg-red-600 text-white font-black">실격 DQ</span>}
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
            sigRef.current?.clear();
            setSigMissing(false);
            if (selectedId) releaseParticipant(selectedId);
            setSelectedId(null);
          }}
          className="h-10 px-4 rounded-lg text-slate-700 font-bold hover:bg-slate-200"
        >
          초기화 · Clear
        </button>
      </div>

      {/* 차수 선택 (1차·2차) */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-slate-900 bg-white px-5 py-4">
        <span className="text-lg font-black text-slate-900 mr-auto">
          경기 차수 <span className="text-sm font-bold text-slate-500">· Round</span>
        </span>
        <div className="flex gap-2" role="radiogroup" aria-label="Round">
          {ROUNDS.map((r) => {
            const on = round === r.key;
            return (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (on) return;
                  if (timerRunning) return notify('초시계 측정 중에는 차수를 바꿀 수 없습니다.');
                  setRound(r.key);
                }}
                className={`h-14 min-w-[6.5rem] px-5 rounded-xl border-2 font-black text-xl transition active:scale-[0.97] ${
                  on ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/25' : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400'
                }`}
              >
                {r.label}
                <span className={`block text-[11px] font-bold leading-none ${on ? 'text-blue-100' : 'text-slate-500'}`}>{r.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {form.dq && (
        <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border-[3px] border-red-600 bg-red-50 px-5 py-4">
          <Ban size={28} className="text-red-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-red-700">실격 처리됨 · Disqualified</p>
            <p className="text-sm font-semibold text-red-900">
              실격 시점까지의 기록({Number(form.lapTime) > 0 ? `${Number(form.lapTime).toFixed(2)}초` : '시간 기록 없음'})과 점수로 저장되고, 결과표에 '실격'으로 표시됩니다. 학생 서명 후 제출하세요.
            </p>
          </div>
          <button type="button" onClick={cancelDq} className="h-11 px-4 rounded-xl border-2 border-red-300 bg-white text-red-700 font-bold hover:bg-red-100">
            실격 취소
          </button>
        </div>
      )}

      {roster.length > 0 && (
        <RosterPicker
          roster={roster}
          claims={claims}
          scores={scores}
          selectedId={selectedId}
          judgeName={judgeName}
          setJudgeName={setJudgeName}
          group={group}
          setGroup={setGroup}
          onSelect={selectParticipant}
          busy={selecting}
          round={round}
        />
      )}

      <ScoreFields
        form={form}
        setForm={setForm}
        stopwatch={sw}
        afterParticipant={hasName && <ReadyAlert acknowledged={readyAck} onAcknowledge={() => setReadyAck(true)} />}
      />

      {/* 5. 학생 서명 (필수) */}
      <div ref={sigSectionRef} className="mt-5">
        <Section
          step="5"
          title="Signature · 학생 서명"
          icon={PenLine}
          accent={hasSignature ? 'emerald' : 'red'}
          right={
            <span className={`text-sm font-black px-3 py-1 rounded-lg ${hasSignature ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
              {hasSignature ? '서명 완료' : '필수 · Required'}
            </span>
          }
        >
          <p className="mb-3 text-sm font-semibold text-slate-700">
            학생이 점수를 확인한 뒤 아래 칸에 서명합니다. <b className="text-red-700">서명이 있어야 제출할 수 있습니다.</b>
          </p>
          <SignatureBox
            ref={sigRef}
            height={240}
            invalid={sigMissing && !hasSignature}
            onChange={(v) => { setHasSignature(v); if (v) setSigMissing(false); }}
          />
        </Section>
      </div>

      {confirmNoTimer && (
        <NoTimerDialog
          lapTime={form.lapTime}
          onBack={() => setConfirmNoTimer(false)}
          onSubmitAnyway={() => handleSubmit(null, { skipTimerCheck: true })}
        />
      )}

      {/* 하단 고정: 초시계 + 실시간 합계 + 제출 */}
      <div className="sticky bottom-3 mt-6 z-40" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="bg-white border-2 border-slate-300 rounded-2xl shadow-xl p-3 flex flex-col lg:flex-row lg:items-center gap-3">
          <StopwatchControl sw={sw} lapTime={form.lapTime} highlightStart={readyAck && sw.status === 'idle'} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 grid grid-cols-4 text-center">
            <Mini label="Mission" value={mission} tone="text-emerald-700" />
            <Mini label="Landing" value={landing} tone="text-violet-700" />
            <Mini label="Time" value={time} tone="text-blue-700" />
            <Mini label="Total" value={total} tone="text-slate-900" big />
          </div>
          <button
            type="button"
            onClick={disqualify}
            disabled={form.dq}
            title="경기를 더 진행할 수 없을 때 실격 처리"
            className={`h-16 px-4 rounded-xl border-2 font-black flex items-center gap-2 transition active:scale-[0.98] ${
              form.dq ? 'bg-red-600 border-red-600 text-white cursor-default' : 'bg-white border-red-500 text-red-600 hover:bg-red-50'
            }`}
          >
            <Ban size={22} />
            <span className="hidden sm:inline">{form.dq ? '실격됨' : '실격'}</span>
          </button>
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

function Dashboard({ scores, roster = [], claims = {}, updateScore, deleteScore, clearScores, saveRoster, clearRoster, notify }) {
  const [editingId, setEditingId] = useState(null);
  const [viewSig, setViewSig] = useState(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all'); // 'all' | 부문 key
  // 보기: best = 참가자별 최고 기록(시상용) | '1' · '2' = 해당 차수만 | all = 모든 기록
  const [mode, setMode] = useState('best');

  const base = useMemo(() => {
    if (mode === 'best') return bestPerPerson(scores);
    if (mode === 'all') return scores;
    return scores.filter((s) => roundOf(s) === mode);
  }, [scores, mode]);

  // 부문별 순위 (같은 부문 안에서만 순위를 매김)
  const byDivision = useMemo(() => groupByDivision(base), [base]);
  const overall = useMemo(() => rankRows(base), [base]);
  const divRank = useMemo(() => {
    const m = {};
    Object.values(byDivision).forEach((rows) => rows.forEach((r) => { m[r.id] = r.rank; }));
    return m;
  }, [byDivision]);
  // 전체 탭: 부문 순서대로 묶고, 부문 안에서는 부문 순위대로
  const ranked = tab === 'all' ? Object.values(byDivision).flat() : byDivision[tab] || [];
  const editing = editingId ? scores.find((s) => s.id === editingId) : null;

  // 수정 중인 기록이 다른 기기에서 삭제되면 모달 닫기
  useEffect(() => {
    if (editingId && !editing) setEditingId(null);
  }, [editingId, editing]);

  // 탭이 사라진 부문을 가리키면 '전체'로
  useEffect(() => {
    if (tab !== 'all' && !byDivision[tab]) setTab('all');
  }, [tab, byDivision]);

  const filtered = query.trim()
    ? ranked.filter((r) => `${r.bib} ${r.name} ${r.affiliation || ''} ${r.country || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    : ranked;

  const [exporting, setExporting] = useState(false);
  const downloadExcel = async () => {
    setExporting(true);
    try {
      await exportResults(scores);
    } catch (e) {
      console.error(e);
      notify('엑셀 파일을 만들지 못했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`#${row.bib} ${row.name} 기록을 삭제할까요?`)) return;
    const res = await deleteScore(row.id);
    notify(res.ok ? '삭제했습니다.' : failMessage(res.reason), res.ok ? 'success' : 'error');
  };

  const handleClear = async () => {
    if (!scores.length) return;
    if (!window.confirm(`⚠️ 전체 ${scores.length}건의 채점 기록을 영구 삭제합니다.\n(참가자 명단은 유지됩니다.) 되돌릴 수 없습니다. 계속할까요?`)) return;
    if (window.prompt('확인을 위해 RESET 을 입력하세요.') !== 'RESET') return;
    const res = await clearScores(scores.map((s) => s.id));
    notify(res.ok ? '전체 기록을 삭제했습니다.' : failMessage(res.reason), res.ok ? 'success' : 'error');
  };

  const top3 = tab === 'all' ? [] : ranked.filter((r) => r.rank != null).slice(0, 3);

  return (
    <div>
      {viewSig && <SignatureViewer row={viewSig} onClose={() => setViewSig(null)} />}

      {editing && (
        <EditModal
          record={editing}
          onClose={() => setEditingId(null)}
          onSave={async (rec) => {
            const res = await updateScore(rec);
            notify(res.ok ? '수정했습니다.' : failMessage(res.reason), res.ok ? 'success' : 'error');
            return res.ok;
          }}
        />
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Trophy className="text-amber-500" size={32} /> Live Leaderboard
          </h2>
          <p className="text-slate-600 font-medium mt-1">
            실시간 순위 · {mode === 'all' ? `기록 ${overall.length}건` : `${overall.length}명`} · 만점 {MAX_TOTAL}점 · 부문별 시상
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadExcel} disabled={!scores.length || exporting} className="h-12 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold flex items-center gap-2">
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} 결과 엑셀 저장
          </button>
          <button onClick={handleClear} disabled={!scores.length} className="h-12 px-5 rounded-xl bg-white border-2 border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-40 font-bold flex items-center gap-2">
            <Trash2 size={18} /> 전체 삭제
          </button>
        </div>
      </div>

      <RosterManager
        roster={roster}
        claims={claims}
        scores={scores}
        saveRoster={saveRoster}
        clearRoster={clearRoster}
        notify={notify}
      />

      {/* 보기 선택: 최고 기록(시상용) · 1차 · 2차 · 전체 기록 */}
      <div className="mb-3 inline-flex flex-wrap gap-1 p-1 rounded-2xl bg-slate-200/70" role="radiogroup" aria-label="기록 보기">
        {[['best', '최고 기록', 'Best · 시상용'], ...ROUNDS.map((r) => [r.key, r.label, r.en]), ['all', '전체 기록', 'All Rounds']].map(([k, label, en]) => (
          <button
            key={k}
            role="radio"
            aria-checked={mode === k}
            onClick={() => setMode(k)}
            className={`h-14 px-4 rounded-xl font-black leading-tight transition ${
              mode === k ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
            <span className="block text-[11px] font-bold text-slate-500">{en}</span>
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm font-semibold text-slate-600">
        {mode === 'best'
          ? `참가자마다 ${ROUNDS.map((r) => r.label).join('·')} 중 더 좋은 기록(총점 → 랩타임 순)으로 순위를 매깁니다. 시상은 이 순위로 합니다.`
          : mode === 'all'
            ? '모든 차수의 기록을 한꺼번에 보여 줍니다. 한 참가자가 여러 줄로 나올 수 있습니다.'
            : `${roundInfo(mode).label} 기록만으로 매긴 순위입니다.`}
      </p>

      {/* 부문 탭 */}
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="부문">
        {[['all', '전체', overall.length], ...Object.entries(byDivision).map(([k, rows]) => [k, divisionInfo(k).label, rows.length])].map(([k, label, n]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`h-12 px-5 rounded-xl border-2 font-black text-lg flex items-center gap-2 transition ${
              tab === k ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-800 hover:border-slate-500'
            }`}
          >
            {label}
            <span className={`text-sm font-bold tabular-nums ${tab === k ? 'text-slate-300' : 'text-slate-500'}`}>{n}</span>
          </button>
        ))}
      </div>

      {/* 전체 탭: 부문별 1~3위 요약 */}
      {tab === 'all' && overall.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          {Object.entries(byDivision).map(([k, rows]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="text-left bg-white border border-slate-200 rounded-2xl shadow-sm p-4 hover:border-slate-400"
            >
              <div className="flex items-center justify-between mb-2">
                <DivisionBadge division={k} size="lg" />
                <span className="text-sm font-bold text-slate-500">{rows.length}명</span>
              </div>
              {rows.length === 0 ? (
                <p className="text-sm font-semibold text-slate-400 py-2">아직 기록 없음</p>
              ) : (
                <ol className="space-y-1">
                  {rows.filter((r) => r.rank != null).slice(0, 3).map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="w-6 text-center">{['🥇', '🥈', '🥉'][r.rank - 1] || r.rank}</span>
                      <span className="flex-1 min-w-0 font-bold text-slate-900 truncate">{r.name}</span>
                      <span className="font-black tabular-nums text-slate-900">{r.totalScore}</span>
                    </li>
                  ))}
                </ol>
              )}
            </button>
          ))}
        </div>
      )}

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
          <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-slate-100 text-slate-700 text-sm font-black">
              <tr>
                <th className="py-3 px-4">{tab === 'all' ? '부문 순위' : 'Rank'}</th>
                <th className="py-3 px-4">Bib</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4 text-center">{mode === 'best' ? '최고 차수' : '차수'}</th>
                <th className="py-3 px-4 text-center">Mission <span className="font-semibold text-slate-500">/{MAX_MISSION}</span></th>
                <th className="py-3 px-4 text-center">Landing <span className="font-semibold text-slate-500">/{MAX_LANDING}</span></th>
                <th className="py-3 px-4 text-right">Lap (s)</th>
                <th className="py-3 px-4 text-center">Time <span className="font-semibold text-slate-500">/{MAX_TIME}</span></th>
                <th className="py-3 px-4 text-center bg-slate-200">Total <span className="font-semibold text-slate-500">/{MAX_TOTAL}</span></th>
                <th className="py-3 px-4 text-center">Signature</th>
                <th className="py-3 px-4 text-center">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-20 text-center text-slate-600 font-medium">
                    {ranked.length === 0 ? '아직 기록이 없습니다. Judge Panel에서 점수를 제출하세요.' : '검색 결과가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className={`border-t border-slate-200 ${row.dq ? 'bg-red-50' : rowTint(tab === 'all' ? 0 : row.rank)}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <RankBadge rank={tab === 'all' ? divRank[row.id] : row.rank} />
                        {tab === 'all' && <DivisionBadge division={row.division} />}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-black text-slate-800 text-lg tabular-nums">{row.bib}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-lg">
                        {row.name}
                        {row.dq && <span className="ml-2 align-middle text-xs font-black px-2 py-0.5 rounded-md bg-red-600 text-white">실격 DQ</span>}
                      </div>
                      {profileLine(row) && <div className="text-xs font-semibold text-slate-500">{profileLine(row)}</div>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block text-sm font-black px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                        {roundInfo(mode === 'best' ? row.bestRound : roundOf(row)).label}
                      </span>
                      {mode === 'best' && (
                        <div className="mt-1 text-xs font-semibold text-slate-500 tabular-nums whitespace-nowrap">
                          {ROUNDS.map((r) => `${r.label} ${row.roundTotals?.[r.key] ?? '—'}${row.roundDq?.[r.key] ? '(실격)' : ''}`).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center"><Chip tone="emerald">{row.missionScore}</Chip></td>
                    <td className="py-3 px-4 text-center"><Chip tone="violet">{row.landingScore}</Chip></td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 text-lg tabular-nums">
                      {row.lapTime > 0 ? row.lapTime.toFixed(2) : <span className="text-red-600">DNF</span>}
                    </td>
                    <td className="py-3 px-4 text-center"><Chip tone="blue">{row.timeScore}</Chip></td>
                    <td className="py-3 px-4 text-center bg-slate-50">
                      <span className="text-3xl font-black text-slate-900 tabular-nums">{row.totalScore}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.signature ? (
                        <button
                          onClick={() => setViewSig(row)}
                          className="inline-block w-28 h-12 rounded-lg border-2 border-slate-200 bg-white hover:border-blue-500 overflow-hidden"
                          aria-label={`${row.name} 서명 크게 보기`}
                          title="서명 크게 보기"
                        >
                          <img src={row.signature} alt="" className="w-full h-full object-contain" />
                        </button>
                      ) : (
                        <span className="text-sm font-bold text-slate-400">없음</span>
                      )}
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
  if (rank == null) {
    return <span className="inline-grid place-items-center h-10 px-2.5 rounded-full bg-red-600 text-white font-black text-sm whitespace-nowrap">실격</span>;
  }
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

/** HQ: 서명 크게 보기 */
function SignatureViewer({ row, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const when = row.timestamp ? new Date(row.timestamp).toLocaleString('ko-KR') : '';
  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Signature" className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-black text-slate-900 truncate">#{row.bib} {row.name} · 서명</h3>
            <p className="text-sm font-semibold text-slate-600 tabular-nums">
              총점 {row.totalScore}점{when ? ` · 제출 ${when}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 shrink-0 grid place-items-center rounded-full hover:bg-slate-100 text-slate-700" aria-label="Close"><X size={22} /></button>
        </div>
        <div className="p-6 bg-slate-50">
          <img src={row.signature} alt={`${row.name} 서명`} className="w-full max-h-[60vh] object-contain bg-white rounded-2xl border-2 border-slate-200" />
        </div>
      </div>
    </div>
  );
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
    round: roundOf(record),
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
          <div className="mb-5 flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-4">
            <span className="font-black text-slate-900 mr-auto">경기 차수 · Round</span>
            {ROUNDS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setForm((f) => ({ ...f, round: r.key }))}
                aria-pressed={form.round === r.key}
                className={`h-11 px-5 rounded-xl border-2 font-black ${form.round === r.key ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <ScoreFields form={form} setForm={setForm} compact />
          <div className={`mt-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 px-5 py-4 ${form.dq ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white'}`}>
            <Ban size={22} className={form.dq ? 'text-red-600' : 'text-slate-500'} />
            <span className="font-black text-slate-900 mr-auto">
              실격 · DQ <span className="text-sm font-semibold text-slate-600">— 순위 없이 결과표에 '실격'으로 표시</span>
            </span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, dq: !f.dq }))}
              aria-pressed={!!form.dq}
              className={`h-11 px-5 rounded-xl border-2 font-black ${form.dq ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-red-400 text-red-700'}`}
            >
              {form.dq ? '실격 해제' : '실격 처리'}
            </button>
          </div>
          <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-5">
            <h4 className="flex items-center gap-2 text-lg font-black text-slate-900"><PenLine size={20} /> 학생 서명</h4>
            {record.signature ? (
              <img src={record.signature} alt="학생 서명" className="mt-3 w-full max-h-40 object-contain rounded-xl border-2 border-slate-200 bg-white" />
            ) : (
              <p className="mt-2 text-sm font-semibold text-slate-500">서명 없음</p>
            )}
            <p className="mt-2 text-xs font-semibold text-slate-500">서명은 수정해도 그대로 유지됩니다.</p>
          </div>
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
