import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../state/AppState';

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { me } = useApp();
  const loc = useLocation();
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (admin && !me.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}
