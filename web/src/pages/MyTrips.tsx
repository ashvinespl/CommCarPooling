import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from '../components/Link';
import { useApp } from '../state/AppState';
import { cancelTrip, publishTrip } from '../mock/engine';
import { EmptyState, Modal, PageHeader, RouteLine } from '../components/ui';
import { formatDateTime, vancouverDate, vancouverTime, addDays, vancouverToIso } from '../lib/time';
import { money } from '../lib/format';
import type { Trip } from '../types';

export function MyTrips() {
  const { db, me, now, run, runWith } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cancelling, setCancelling] = useState<Trip | null>(null);
  const [reason, setReason] = useState('');
  const mine = db.trips.filter((t) => t.driverId === me!.id);
  const upcoming = mine.filter((t) => t.status === 'scheduled' && new Date(t.departureAt) > now).sort((a, b) => a.departureAt.localeCompare(b.departureAt));
  const past = mine.filter((t) => !upcoming.includes(t)).sort((a, b) => b.departureAt.localeCompare(a.departureAt));
  const list = tab === 'upcoming' ? upcoming : past;

  const duplicate = (t: Trip) => {
    // Same route and time, one week later.
    const nextDate = addDays(vancouverDate(t.departureAt), 7);
    const res = runWith((d, n) => publishTrip(d, me!.id, {
      origin: t.stops[0], destination: t.stops[t.stops.length - 1], via: t.stops.slice(1, -1),
      departureAt: vancouverToIso(nextDate, vancouverTime(t.departureAt)), seats: t.seatsTotal, contributionCents: t.contributionCents,
      luggageOk: t.luggageOk, notes: t.notes, accessibilityNotes: t.accessibilityNotes, meetingPoint: t.meetingPoint, vehicle: t.vehicle,
    }, n), 'Trip duplicated for next week.');
    if (res) navigate(`/trips/${res.tripId}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="My trips" />
      <div className="mb-4 flex gap-2">
        <Link to="/offer" className="btn-primary">+ Offer a seat</Link>
        <div className="ml-auto flex rounded-xl bg-stone-200 p-1 text-sm" role="tablist">
          {(['upcoming', 'past'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 capitalize ${tab === t ? 'bg-white font-semibold shadow-sm' : ''}`}>{t}</button>)}
        </div>
      </div>
      {list.length === 0 && <EmptyState title={tab === 'upcoming' ? 'No upcoming trips' : 'No past trips'}>Trips you publish appear here.</EmptyState>}
      <ul className="space-y-3">
        {list.map((t) => {
          const pending = db.bookings.filter((b) => b.tripId === t.id && b.status === 'pending').length;
          return (
            <li key={t.id} className="card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/trips/${t.id}`} className="font-semibold hover:underline">{formatDateTime(t.departureAt)}</Link>
                <span className={`text-xs font-semibold ${t.status === 'cancelled' ? 'text-red-700' : 'text-ink-500'}`}>{t.status === 'scheduled' && new Date(t.departureAt) <= now ? 'departed' : t.status}</span>
              </div>
              <RouteLine stops={t.stops} />
              <p className="text-sm text-ink-700">{t.seatsBooked}/{t.seatsTotal} seats booked · {money(t.contributionCents)} each
                {pending > 0 && <Link to="/bookings?tab=driver" className="ml-2 rounded-full bg-accent-500 px-2 py-0.5 text-xs font-semibold text-white">{pending} pending</Link>}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn-outline min-h-[36px]" onClick={() => duplicate(t)}>Duplicate for next week</button>
                {tab === 'upcoming' && <button className="btn-danger min-h-[36px]" onClick={() => { setCancelling(t); setReason(''); }}>Cancel trip</button>}
              </div>
            </li>
          );
        })}
      </ul>
      <Modal open={!!cancelling} title="Cancel this trip?" onClose={() => setCancelling(null)}>
        <p className="text-sm text-ink-700">All passengers with pending or accepted requests will be notified. If you cancel within {db.settings.lateCancelHours} hours of departure, it’s recorded as a late cancellation.</p>
        <label htmlFor="cr" className="label mt-3">Reason for passengers</label>
        <input id="cr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Car trouble" />
        <div className="mt-4 flex gap-2">
          <button className="btn-outline flex-1" onClick={() => setCancelling(null)}>Keep trip</button>
          <button className="btn-danger flex-1" onClick={() => { if (run((d, n) => cancelTrip(d, me!.id, cancelling!.id, reason, n), 'Trip cancelled. Passengers notified.')) setCancelling(null); }}>Cancel trip</button>
        </div>
      </Modal>
    </div>
  );
}
