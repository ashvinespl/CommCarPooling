import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Db, User } from '../types';
import { buildSeed } from '../mock/seed';
import { EngineError, expireDeparted, getUser, track as trackEvent } from '../mock/engine';

const STORAGE_KEY = 'ccp-prototype-v1';

interface Persisted { db: Db; currentUserId?: string; seededAt: string }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      // Re-seed if the demo data is more than 3 days old so sample trips stay upcoming.
      if (Date.now() - new Date(p.seededAt).getTime() < 3 * 86400000) return p;
    }
  } catch { /* storage unavailable: fall through to fresh seed */ }
  return { db: buildSeed(), currentUserId: undefined, seededAt: new Date().toISOString() };
}

interface Toast { id: number; kind: 'success' | 'error'; text: string }

interface AppState {
  db: Db;
  me?: User;
  now: Date;
  signInAs: (userId?: string) => void;
  /** Run an engine mutation; shows a friendly toast on rule violations. Returns true on success. */
  run: (fn: (db: Db, now: Date) => Db, success?: string) => boolean;
  /** Like run, but for engine calls that also return a value. */
  runWith: <T>(fn: (db: Db, now: Date) => { db: Db } & T, success?: string) => T | undefined;
  track: (name: string) => void;
  resetDemo: () => void;
  toasts: Toast[];
  notify: (kind: Toast['kind'], text: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const now = new Date();

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  // Equivalent of the scheduled expiry job, run on load and every minute.
  useEffect(() => {
    const tick = () => setState((s) => ({ ...s, db: expireDeparted(s.db, new Date()) }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const notify = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const runWith = useCallback(<T,>(fn: (db: Db, now: Date) => { db: Db } & T, success?: string): T | undefined => {
    try {
      const result = fn(state.db, new Date());
      setState((s) => ({ ...s, db: result.db }));
      if (success) notify('success', success);
      return result;
    } catch (e) {
      notify('error', e instanceof EngineError ? e.message : 'Something went wrong. Please try again.');
      if (!(e instanceof EngineError)) console.error(e);
      return undefined;
    }
  }, [state.db, notify]);

  const run = useCallback((fn: (db: Db, now: Date) => Db, success?: string) =>
    runWith((db, n) => ({ db: fn(db, n) }), success) !== undefined, [runWith]);

  const value = useMemo<AppState>(() => ({
    db: state.db,
    me: state.currentUserId ? getUser(state.db, state.currentUserId) : undefined,
    now,
    signInAs: (userId) => setState((s) => ({ ...s, currentUserId: userId })),
    run, runWith,
    track: (name) => setState((s) => ({ ...s, db: trackEvent(s.db, name, s.currentUserId) })),
    resetDemo: () => setState({ db: buildSeed(), currentUserId: undefined, seededAt: new Date().toISOString() }),
    toasts, notify,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, run, runWith, toasts, notify]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
