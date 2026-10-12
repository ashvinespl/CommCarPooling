import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from './Link';
import type { BookingStatus, User, ZoneId } from '../types';
import { initials, money } from '../lib/format';
import { ZONES, zoneById } from '../mock/zones';

export function Avatar({ user, size = 40 }: { user: Pick<User, 'displayName' | 'avatarColor'>; size?: number }) {
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: user.avatarColor, fontSize: size * 0.38 }}>
      {initials(user.displayName)}
    </span>
  );
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-900',
  accepted: 'bg-brand-100 text-brand-900',
  declined: 'bg-stone-200 text-ink-700',
  cancelled: 'bg-red-100 text-red-800',
  expired: 'bg-stone-200 text-ink-700',
  completed: 'bg-sky-100 text-sky-900',
};
const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired', completed: 'Completed',
};
export function StatusPill({ status }: { status: BookingStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function RouteLine({ stops, highlight }: { stops: ZoneId[]; highlight?: [ZoneId, ZoneId] }) {
  const [from, to] = highlight ?? [stops[0], stops[stops.length - 1]];
  const i = stops.indexOf(from); const j = stops.indexOf(to);
  return (
    <ol className="flex flex-wrap items-center gap-1 text-sm" aria-label="Route">
      {stops.map((z, k) => {
        const on = k >= i && k <= j;
        return (
          <li key={z} className="flex items-center gap-1">
            <span className={`rounded-md px-1.5 py-0.5 ${on ? 'bg-brand-50 font-medium text-brand-900' : 'text-ink-500'}`}>{zoneById(z).name}</span>
            {k < stops.length - 1 && <span aria-hidden className="text-stone-400">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function ZoneSelect({ id, label, value, onChange, options = ZONES.map((z) => z.id), exclude }: {
  id: string; label: string; value: ZoneId | ''; onChange: (v: ZoneId) => void; options?: ZoneId[]; exclude?: ZoneId;
}) {
  const grouped = ['Surrey', 'White Rock'].map((m) => ({ m, zones: options.map(zoneById).filter((z) => z.municipality === m && z.id !== exclude) }));
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value="" disabled>Choose a pickup zone…</option>
        {grouped.filter((g) => g.zones.length).map((g) => (
          <optgroup key={g.m} label={g.m}>
            {g.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export function Contribution({ cents, className = '' }: { cents: number; className?: string }) {
  return (
    <span className={className}>
      <span className="font-semibold">{money(cents)}</span>
      <span className="ml-1 text-xs text-ink-500">{cents ? 'proposed contribution' : 'no contribution asked'}</span>
    </span>
  );
}

export function ContributionNotice() {
  return (
    <p className="rounded-xl bg-stone-100 p-3 text-xs text-ink-700">
      <strong>Proposed contribution toward trip costs — not a fare.</strong> Settle it directly with the driver
      (e.g. cash or e-Transfer). This pilot does not process payments or take any commission.
    </p>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-8 text-center">
      <p className="h2">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-500">{children}</div>}
      {action}
    </div>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose} aria-labelledby="modal-title"
      className="w-[min(92vw,28rem)] rounded-2xl p-0 backdrop:bg-black/40">
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="h2">{title}</h2>
          <button className="btn-ghost -mr-2 -mt-2 min-h-0 px-2 py-1" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function PageHeader({ title, back, children }: { title: string; back?: string; children?: ReactNode }) {
  return (
    <div className="mb-4">
      {back && <Link to={back} className="mb-1 inline-block text-sm text-brand-700 hover:underline">← Back</Link>}
      <h1 className="h1">{title}</h1>
      {children && <div className="mt-1 text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function PrivateBadge() {
  return <span className="ml-1 rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-700">Private</span>;
}
