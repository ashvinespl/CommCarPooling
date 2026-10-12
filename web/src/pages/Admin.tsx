import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { anonymizedBookingsCsv, computeMetrics, getTrip, getUser, setAccountStatus, updateReport, updateSettings } from '../mock/engine';
import { Modal, PageHeader, StatusPill } from '../components/ui';
import { formatDateTime } from '../lib/time';
import { money } from '../lib/format';
import { zoneById } from '../mock/zones';
import type { ReportStatus, User } from '../types';

const TABS = ['Overview', 'Users', 'Reports', 'Trips & bookings', 'Feedback & demand', 'Export & settings'] as const;
type Tab = (typeof TABS)[number];
const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)}%`);

export function Admin() {
  const { db } = useApp();
  const [tab, setTab] = useState<Tab>('Overview');
  const openReports = db.reports.filter((r) => r.status === 'open').length;
  return (
    <div>
      <PageHeader title="Pilot admin">Prototype dashboard using sample data.</PageHeader>
      <div className="-mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1 rounded-xl bg-stone-200 p-1 text-sm" role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${tab === t ? 'bg-white font-semibold shadow-sm' : ''}`}>
              {t}{t === 'Reports' && openReports > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{openReports}</span>}
            </button>
          ))}
        </div>
      </div>
      {tab === 'Overview' && <Overview />}
      {tab === 'Users' && <Users />}
      {tab === 'Reports' && <Reports />}
      {tab === 'Trips & bookings' && <TripsBookings />}
      {tab === 'Feedback & demand' && <FeedbackDemand />}
      {tab === 'Export & settings' && <ExportSettings />}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return <div className="card"><p className="text-xs font-medium text-ink-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>{sub && <p className="text-xs text-ink-500">{sub}</p>}</div>;
}

function Overview() {
  const { db } = useApp();
  const m = computeMetrics(db);
  const targets = [
    { label: 'Drivers', value: m.drivers, target: '20–30' }, { label: 'Passengers', value: m.passengers, target: '50–100' }, { label: 'Published trips', value: m.tripsPublished, target: '30+' },
  ];
  const landing = db.events.filter((e) => e.name === 'landing_view').length;
  return (
    <div className="space-y-6">
      <section>
        <h2 className="h2 mb-2">Pilot targets <span className="text-xs font-normal text-ink-500">(experimental, not forecasts)</span></h2>
        <div className="grid grid-cols-3 gap-3">{targets.map((t) => <Tile key={t.label} label={t.label} value={t.value} sub={`target ${t.target}`} />)}</div>
      </section>
      <section>
        <h2 className="h2 mb-2">Marketplace</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Activated users" value={m.activatedUsers} sub={`of ${m.users} registered`} />
          <Tile label="Seat requests" value={m.seatRequests} />
          <Tile label="Acceptance rate" value={pct(m.acceptanceRate)} sub={`${m.acceptedEver} accepted`} />
          <Tile label="Completed rides" value={m.completedRides} sub="self-reported" />
          <Tile label="Cancellation rate" value={pct(m.cancellationRate)} sub={`${m.lateCancellations} late`} />
          <Tile label="No-show reports" value={m.noShowReports} />
          <Tile label="Repeat passengers" value={m.repeatPassengers} sub="2+ completed rides" />
          <Tile label="Avg contribution" value={m.avgContributionCents == null ? '—' : money(m.avgContributionCents)} />
          <Tile label="Settled (self-reported)" value={pct(m.settledShare)} />
          <Tile label="Median minutes saved" value={m.medianMinutesSaved ?? '—'} />
          <Tile label="Searches with no results" value={`${m.searchesNoResults}/${m.searches}`} />
          <Tile label="Open reports" value={m.openReports} />
        </div>
      </section>
      <section className="card">
        <h2 className="h2 mb-2">Funnel (this browser’s demo events)</h2>
        <ul className="space-y-1 text-sm">
          {[['Landing page views', landing], ['Sign-ups started', db.events.filter((e) => e.name === 'signup_started').length], ['Sign-ups completed', db.events.filter((e) => e.name === 'signup_completed').length],
            ['Booking requests started', db.events.filter((e) => e.name === 'booking_request_started').length], ['Booking requests sent', db.events.filter((e) => e.name === 'booking_requested').length],
            ['Publish started', db.events.filter((e) => e.name === 'publish_started').length], ['Publish abandoned', db.events.filter((e) => e.name === 'publish_abandoned').length], ['Trips published', db.events.filter((e) => e.name === 'trip_published').length]]
            .map(([l, v]) => <li key={l as string} className="flex justify-between border-b border-stone-100 py-1"><span>{l}</span><b>{v}</b></li>)}
        </ul>
      </section>
    </div>
  );
}

function Users() {
  const { db, me, run } = useApp();
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<User | null>(null);
  const [reason, setReason] = useState('');
  const users = db.users.filter((u) => `${u.displayName} ${u.fullName} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <input aria-label="Search users" className="input" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs text-ink-500"><tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Trips</th><th className="p-3">Bookings</th><th className="p-3">Late cancels</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-stone-100">
                <td className="p-3"><p className="font-medium">{u.displayName}</p><p className="text-xs text-ink-500">{u.fullName} · {u.email}</p></td>
                <td className="p-3 capitalize">{u.isAdmin ? 'admin' : u.role}</td>
                <td className="p-3">{db.trips.filter((t) => t.driverId === u.id).length}</td>
                <td className="p-3">{db.bookings.filter((b) => b.passengerId === u.id).length}</td>
                <td className="p-3">{db.bookings.filter((b) => b.lateCancellation && b.cancelledBy === u.id).length}</td>
                <td className="p-3">{u.status === 'active' ? 'Active' : <span className="font-semibold text-red-700">Suspended</span>}</td>
                <td className="p-3 text-right">{!u.isAdmin && (u.status === 'active'
                  ? <button className="btn-danger min-h-[32px] py-1" onClick={() => { setTarget(u); setReason(''); }}>Suspend</button>
                  : <button className="btn-outline min-h-[32px] py-1" onClick={() => run((d, n) => setAccountStatus(d, me!.id, u.id, 'active', 'Reinstated', n), 'Reinstated.')}>Reinstate</button>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!target} title={`Suspend ${target?.displayName}?`} onClose={() => setTarget(null)}>
        <p className="text-sm text-ink-700">They won’t be able to publish, request or message. This action is logged.</p>
        <label htmlFor="sr" className="label mt-3">Reason (shown to the user)</label>
        <input id="sr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn-danger mt-4 w-full" onClick={() => { if (run((d, n) => setAccountStatus(d, me!.id, target!.id, 'suspended', reason, n), 'Account suspended.')) setTarget(null); }}>Suspend account</button>
      </Modal>
    </div>
  );
}

function Reports() {
  const { db, me, run } = useApp();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const reports = [...db.reports].sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1) || b.createdAt.localeCompare(a.createdAt));
  if (!reports.length) return <p className="text-sm text-ink-500">No reports.</p>;
  return (
    <ul className="space-y-3">
      {reports.map((r) => (
        <li key={r.id} className="card space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold capitalize">{r.category.replace(/_/g, ' ')}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.status === 'open' ? 'bg-red-100 text-red-800' : 'bg-stone-200'}`}>{r.status}</span>
          </div>
          <p>{r.details}</p>
          <p className="text-xs text-ink-500">From {getUser(db, r.reporterId)?.displayName} {r.reportedId && <>about <b>{getUser(db, r.reportedId)?.displayName}</b></>} · {formatDateTime(r.createdAt)}
            {r.tripId && <> · <Link className="underline" to={`/trips/${r.tripId}`}>trip</Link></>}{r.bookingId && <> · <Link className="underline" to={`/bookings/${r.bookingId}`}>booking</Link></>}</p>
          <label htmlFor={`n-${r.id}`} className="sr-only">Admin notes</label>
          <input id={`n-${r.id}`} className="input" placeholder="Admin notes (private)" value={notes[r.id] ?? r.adminNotes ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            {(['reviewing', 'actioned', 'dismissed'] as ReportStatus[]).map((s) => (
              <button key={s} className="btn-outline min-h-[32px] py-1 capitalize" onClick={() => run((d, n) => updateReport(d, me!.id, r.id, s, notes[r.id] ?? r.adminNotes, n), `Marked ${s}.`)}>{s}</button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function TripsBookings() {
  const { db } = useApp();
  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="p-3 text-left font-semibold">Trips ({db.trips.length})</caption>
          <thead className="bg-stone-50 text-xs text-ink-500"><tr><th className="p-3">Departs</th><th className="p-3">Route</th><th className="p-3">Driver</th><th className="p-3">Seats</th><th className="p-3">$</th><th className="p-3">Status</th></tr></thead>
          <tbody>{[...db.trips].sort((a, b) => a.departureAt.localeCompare(b.departureAt)).map((t) => (
            <tr key={t.id} className="border-t border-stone-100">
              <td className="p-3"><Link className="underline" to={`/trips/${t.id}`}>{formatDateTime(t.departureAt)}</Link></td>
              <td className="p-3">{t.stops.map((z) => zoneById(z).name).join(' → ')}</td>
              <td className="p-3">{getUser(db, t.driverId)?.displayName}</td>
              <td className="p-3">{t.seatsBooked}/{t.seatsTotal}</td><td className="p-3">{money(t.contributionCents)}</td><td className="p-3">{t.status}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="p-3 text-left font-semibold">Bookings ({db.bookings.length})</caption>
          <thead className="bg-stone-50 text-xs text-ink-500"><tr><th className="p-3">Trip</th><th className="p-3">Passenger</th><th className="p-3">Segment</th><th className="p-3">Status</th></tr></thead>
          <tbody>{db.bookings.map((b) => (
            <tr key={b.id} className="border-t border-stone-100">
              <td className="p-3">{formatDateTime(getTrip(db, b.tripId)!.departureAt)}</td>
              <td className="p-3">{getUser(db, b.passengerId)?.displayName}</td>
              <td className="p-3">{zoneById(b.pickupZoneId).name} → {zoneById(b.dropoffZoneId).name}</td>
              <td className="p-3"><StatusPill status={b.status} />{b.lateCancellation && <span className="ml-1 text-xs text-red-700">late</span>}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

function FeedbackDemand() {
  const { db } = useApp();
  const pairs = new Map<string, number>();
  db.rideRequests.forEach((r) => { const k = `${zoneById(r.originZoneId).name} → ${zoneById(r.destinationZoneId).name}${r.earliest ? ` (${r.earliest.slice(0, 2)}:00+)` : ''}`; pairs.set(k, (pairs.get(k) ?? 0) + 1); });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <h2 className="h2 mb-2">Unmet demand</h2>
        {pairs.size === 0 ? <p className="text-sm text-ink-500">No ride requests yet.</p> :
          <ul className="space-y-1 text-sm">{[...pairs].sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k} className="flex justify-between border-b border-stone-100 py-1"><span>{k}</span><b>{v}</b></li>)}</ul>}
      </div>
      <div className="card">
        <h2 className="h2 mb-2">Post-trip feedback ({db.feedback.length})</h2>
        {db.feedback.length === 0 ? <p className="text-sm text-ink-500">No feedback yet. Demo: sign in as Priya S. and open Bookings to answer the survey.</p> :
          <ul className="space-y-2 text-sm">{db.feedback.map((f) => (
            <li key={f.id} className="rounded-lg bg-stone-50 p-2">
              <b className="capitalize">{f.authorRole}</b>: {f.outcome.replace(/_/g, ' ')} · settled: {f.settled ?? '—'} · safe: {f.feltSafe == null ? '—' : f.feltSafe ? 'yes' : 'no'} · {f.rating ? `${f.rating}/5` : ''}
              {f.comments && <p className="mt-1 italic">“{f.comments}”</p>}
            </li>))}</ul>}
      </div>
    </div>
  );
}

function ExportSettings() {
  const { db, me, run } = useApp();
  const [cap, setCap] = useState(String(db.settings.maxContributionCents / 100));
  const [late, setLate] = useState(String(db.settings.lateCancelHours));
  const download = () => {
    const csv = anonymizedBookingsCsv(db, (id) => zoneById(id).name);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `pilot-bookings-anonymized-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card space-y-2">
        <h2 className="h2">Anonymized export</h2>
        <p className="text-sm text-ink-700">One row per booking: date, hour, zones, seats, contribution, status, outcomes, settlement and minutes saved. No names, emails, phone numbers, IDs, messages or free text.</p>
        <button className="btn-primary" onClick={download}>Download CSV</button>
      </div>
      <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); run((d) => updateSettings(d, me!.id, { maxContributionCents: Math.round(Number(cap) * 100), lateCancelHours: Number(late) }), 'Settings saved.'); }}>
        <h2 className="h2">Pilot settings</h2>
        <div><label htmlFor="cap" className="label">Contribution cap per passenger ($)</label><input id="cap" type="number" min={0} step="0.5" className="input" value={cap} onChange={(e) => setCap(e.target.value)} />
          <p className="hint">Set to $15 as a placeholder until the legal and insurance review is done.</p></div>
        <div><label htmlFor="late" className="label">Late-cancellation window (hours)</label><input id="late" type="number" min={0} className="input" value={late} onChange={(e) => setLate(e.target.value)} /></div>
        <button className="btn-primary">Save settings</button>
      </form>
    </div>
  );
}
