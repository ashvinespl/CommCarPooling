import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Link, NavLink } from './Link';
import { useApp } from '../state/AppState';

const tabs = [
  { to: '/search', label: 'Find', icon: '🔍' },
  { to: '/offer', label: 'Offer', icon: '🚗' },
  { to: '/bookings', label: 'Bookings', icon: '🎫' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

export function Layout() {
  const { db, me, signInAs, resetDemo, toasts } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pendingForMe = me ? db.bookings.filter((b) => b.status === 'pending' && db.trips.find((t) => t.id === b.tripId)?.driverId === me.id).length : 0;

  return (
    <div className="min-h-screen">
      <div className="bg-ink-900 px-4 py-2 text-center text-xs text-white">
        <strong>Clickable prototype</strong> — sample data only, nothing is sent anywhere.{' '}
        <button className="underline" onClick={() => { resetDemo(); navigate('/'); }}>Reset demo</button>
      </div>
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
          <Link to="/" className="flex items-center gap-2 font-bold text-brand-700">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">⇄</span>
            <span className="hidden sm:inline">CommCarPooling</span>
          </Link>
          <nav className="ml-4 hidden gap-1 md:flex" aria-label="Main">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} className={({ isActive }) => `btn-ghost min-h-[36px] ${isActive ? 'bg-brand-50 text-brand-700' : ''}`}>
                {t.label}{t.to === '/bookings' && pendingForMe > 0 && <span className="rounded-full bg-accent-500 px-1.5 text-xs text-white">{pendingForMe}</span>}
              </NavLink>
            ))}
            {me?.isAdmin && <NavLink to="/admin" className={({ isActive }) => `btn-ghost min-h-[36px] ${isActive ? 'bg-brand-50 text-brand-700' : ''}`}>Admin</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="demo-user" className="hidden text-xs text-ink-500 sm:block">Demo as</label>
            <select id="demo-user" className="input min-h-[36px] w-auto py-1 text-sm" value={me?.id ?? ''}
              onChange={(e) => { signInAs(e.target.value || undefined); if (!e.target.value) navigate('/'); }}>
              <option value="">Signed out</option>
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName}{u.isAdmin ? ' (admin)' : u.role === 'driver' ? ' (driver)' : u.role === 'both' ? ' (both)' : ' (passenger)'}</option>
              ))}
            </select>
            {me?.isAdmin && <Link to="/admin" className="btn-outline min-h-[36px] md:hidden">Admin</Link>}
          </div>
        </div>
      </header>

      {me?.status === 'suspended' && (
        <div role="alert" className="bg-red-50 px-4 py-2 text-center text-sm text-red-800">
          Your account is suspended ({me.suspendedReason}). You can browse, but not publish, request or message. Contact the pilot team.
        </div>
      )}

      <main className={`mx-auto max-w-5xl px-4 pb-28 pt-4 md:pb-12 ${pathname === '/' ? 'max-w-none px-0 pt-0' : ''}`}>
        <Outlet />
      </main>

      <footer className="mx-auto hidden max-w-5xl px-4 pb-8 text-xs text-ink-500 md:block">
        <FooterLinks />
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `relative flex min-h-[56px] flex-col items-center justify-center text-xs ${isActive ? 'font-semibold text-brand-700' : 'text-ink-500'}`}>
            <span aria-hidden className="text-lg leading-none">{t.icon}</span>{t.label}
            {t.to === '/bookings' && pendingForMe > 0 && <span className="absolute right-1/4 top-1.5 rounded-full bg-accent-500 px-1.5 text-[10px] text-white">{pendingForMe}</span>}
          </NavLink>
        ))}
      </nav>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm shadow-lg ${t.kind === 'error' ? 'bg-red-700 text-white' : 'bg-ink-900 text-white'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FooterLinks() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <Link to="/info/terms" className="hover:underline">Terms of Use</Link>
      <Link to="/info/privacy" className="hover:underline">Privacy Notice</Link>
      <Link to="/info/safety" className="hover:underline">Community Safety Rules</Link>
      <Link to="/info/contributions" className="hover:underline">How contributions work</Link>
      <Link to="/info/faq" className="hover:underline">Pilot FAQ</Link>
      <span>Emergency? Call 911. This platform is not an emergency service and does not provide insurance.</span>
    </div>
  );
}
