import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { canGiveFeedback, cancelBooking, getBooking, getTrip, getUser, isBookingParty, respondToBooking, sendMessage } from '../mock/engine';
import { Avatar, EmptyState, Modal, PageHeader, StatusPill } from '../components/ui';
import { TrustActions } from '../components/Trust';
import { formatDateTime, formatTime } from '../lib/time';
import { money, plural } from '../lib/format';
import { zoneById } from '../mock/zones';
import type { Booking } from '../types';

export function Bookings() {
  const { db, me, now } = useApp();
  const [params, setParams] = useSearchParams();
  const isDriver = me!.role !== 'passenger';
  const tab = params.get('tab') === 'driver' && isDriver ? 'driver' : 'passenger';
  const mine = db.bookings.filter((b) => b.passengerId === me!.id);
  const forMyTrips = db.bookings.filter((b) => getTrip(db, b.tripId)?.driverId === me!.id);
  const list = (tab === 'driver' ? forMyTrips : mine).slice().sort((a, b) => {
    const order = (x: Booking) => (x.status === 'pending' ? 0 : x.status === 'accepted' ? 1 : 2);
    return order(a) - order(b) || getTrip(db, a.tripId)!.departureAt.localeCompare(getTrip(db, b.tripId)!.departureAt);
  });
  const feedbackDue = db.bookings.filter((b) => canGiveFeedback(db, b, me!.id, now));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Bookings" />
      {feedbackDue.map((b) => (
        <Link key={b.id} to={`/bookings/${b.id}/feedback`} className="card mb-3 flex items-center justify-between border-sky-200 bg-sky-50">
          <span className="text-sm"><b>How did your trip go?</b> {formatDateTime(getTrip(db, b.tripId)!.departureAt)}. Takes under a minute.</span>
          <span aria-hidden>→</span>
        </Link>
      ))}
      {isDriver && (
        <div className="mb-4 flex rounded-xl bg-stone-200 p-1 text-sm" role="tablist">
          <button role="tab" aria-selected={tab === 'passenger'} onClick={() => setParams({})} className={`flex-1 rounded-lg px-3 py-1.5 ${tab === 'passenger' ? 'bg-white font-semibold shadow-sm' : ''}`}>My requests</button>
          <button role="tab" aria-selected={tab === 'driver'} onClick={() => setParams({ tab: 'driver' })} className={`flex-1 rounded-lg px-3 py-1.5 ${tab === 'driver' ? 'bg-white font-semibold shadow-sm' : ''}`}>
            Requests for my trips {forMyTrips.some((b) => b.status === 'pending') && <span className="ml-1 rounded-full bg-accent-500 px-1.5 text-xs text-white">{forMyTrips.filter((b) => b.status === 'pending').length}</span>}
          </button>
        </div>
      )}
      {list.length === 0 && (tab === 'driver'
        ? <EmptyState title="No requests yet" action={<Link to="/my-trips" className="btn-outline">My trips</Link>}>When passengers request seats on your trips, they’ll appear here.</EmptyState>
        : <EmptyState title="No bookings yet" action={<Link to="/search" className="btn-primary">Find a ride</Link>} />)}
      <ul className="space-y-3">{list.map((b) => <li key={b.id}><BookingRow booking={b} asDriver={tab === 'driver'} /></li>)}</ul>
    </div>
  );
}

function BookingRow({ booking: b, asDriver }: { booking: Booking; asDriver: boolean }) {
  const { db, me, run } = useApp();
  const t = getTrip(db, b.tripId)!;
  const other = getUser(db, asDriver ? b.passengerId : t.driverId)!;
  return (
    <div className="card space-y-2">
      <Link to={`/bookings/${b.id}`} className="block">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{formatDateTime(t.departureAt)}</span>
          <StatusPill status={b.status} />
        </div>
        <p className="mt-1 text-sm text-ink-700">{zoneById(b.pickupZoneId).name} → {zoneById(b.dropoffZoneId).name} · {plural(b.seats, 'seat')} · {money(t.contributionCents)}</p>
        <div className="mt-2 flex items-center gap-2 text-sm"><Avatar user={other} size={24} />{asDriver ? 'Passenger' : 'Driver'}: {other.displayName}</div>
        {asDriver && b.message && <p className="mt-2 rounded-lg bg-stone-50 p-2 text-sm italic">“{b.message}”</p>}
      </Link>
      {asDriver && b.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button className="btn-outline flex-1" onClick={() => run((d, n) => respondToBooking(d, me!.id, b.id, false, n).db, 'Request declined.')}>Decline</button>
          <button className="btn-primary flex-1" onClick={() => run((d, n) => respondToBooking(d, me!.id, b.id, true, n).db, 'Accepted! The passenger can now see the meeting point.')}>Accept</button>
        </div>
      )}
    </div>
  );
}

export function BookingDetail() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { db, me, now, run, notify } = useApp();
  const [body, setBody] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const b = getBooking(db, id);
  if (!b || !(isBookingParty(db, b, me!.id) || me!.isAdmin)) return <EmptyState title="Booking not found" />;
  const t = getTrip(db, b.tripId)!;
  const asDriver = t.driverId === me!.id;
  const other = getUser(db, asDriver ? b.passengerId : t.driverId)!;
  const msgs = db.messages.filter((m) => m.bookingId === b.id);
  const live = b.status === 'pending' || b.status === 'accepted';
  const revealed = b.status === 'accepted' || b.status === 'completed';
  const lateWindow = new Date(t.departureAt).getTime() - now.getTime() < db.settings.lateCancelHours * 3600000;

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (run((d, n) => sendMessage(d, me!.id, b.id, body, n))) setBody('');
  };
  const shareText = `Carpool: ${formatDateTime(t.departureAt)} from ${zoneById(b.pickupZoneId).name} to ${zoneById(b.dropoffZoneId).name}. Driver: ${getUser(db, t.driverId)!.displayName}, ${t.vehicle ?? 'vehicle not specified'}. Meeting point: ${t.meetingPoint ?? 'TBC'}.`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Booking" back="/bookings" />
      {params.get('report') && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Sorry the trip didn’t go as planned. If there was a no-show or safety concern, please use <b>Report</b> below so the pilot team can follow up.
        </p>
      )}
      <div className="card space-y-2">
        <div className="flex items-center justify-between"><span className="font-semibold">{formatDateTime(t.departureAt)}</span><StatusPill status={b.status} /></div>
        <p className="text-sm">{zoneById(b.pickupZoneId).name} → {zoneById(b.dropoffZoneId).name} · {plural(b.seats, 'seat')}</p>
        <p className="text-sm">Proposed contribution: <b>{money(t.contributionCents * b.seats)}</b> <span className="text-ink-500">(settle directly)</span></p>
        <Link to={`/trips/${t.id}`} className="text-sm text-brand-700 underline">View trip</Link>
        {b.status === 'pending' && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{asDriver ? 'Waiting for your answer.' : 'Waiting for the driver to respond. Requests expire at departure if unanswered.'}</p>}
        {b.status === 'cancelled' && <p className="text-sm text-red-700">Cancelled{b.cancelReason ? `: ${b.cancelReason}` : ''}{b.lateCancellation ? ' (late cancellation)' : ''}</p>}
        {b.status === 'declined' && <p className="text-sm text-ink-700">The driver couldn’t take this request. <Link className="underline" to="/search">Find another trip</Link></p>}
        {b.status === 'expired' && <p className="text-sm text-ink-700">This request expired without an answer. <Link className="underline" to="/ride-request">Tell us the ride you need</Link></p>}
      </div>

      {revealed && (
        <div className="card border-brand-200 bg-brand-50 text-sm">
          <p className="font-semibold text-brand-900">Meeting point</p><p>{t.meetingPoint ?? 'Ask the driver in messages.'}</p>
          <p className="mt-2 font-semibold text-brand-900">Vehicle</p><p>{t.vehicle ?? 'Not specified'}</p>
          {other.sharePhoneAfterAccept && other.phone && me!.sharePhoneAfterAccept && <><p className="mt-2 font-semibold text-brand-900">Phone</p><p>{other.phone}</p></>}
          <button className="btn-outline mt-3 min-h-[36px] w-full bg-white" onClick={() => { navigator.clipboard?.writeText(shareText).then(() => notify('success', 'Trip details copied.'), () => notify('error', 'Couldn’t copy. Select the text below instead.')); }}>Copy trip details to share with someone you trust</button>
          <p className="mt-2 select-all rounded-lg bg-white p-2 text-xs text-ink-700">{shareText}</p>
        </div>
      )}

      <div className="card">
        <div className="mb-2 flex items-center gap-2"><Avatar user={other} size={32} /><span className="font-semibold">{other.displayName}</span></div>
        <ul className="max-h-80 space-y-2 overflow-y-auto" aria-label="Messages">
          {msgs.length === 0 && <li className="text-sm text-ink-500">No messages yet. Keep conversations here rather than sharing personal contact details.</li>}
          {msgs.map((m) => (
            <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.senderId === me!.id ? 'ml-auto bg-brand-600 text-white' : 'bg-stone-100'}`}>
              {m.body}<span className="mt-0.5 block text-[10px] opacity-70">{formatTime(m.createdAt)}</span>
            </li>
          ))}
        </ul>
        {live ? (
          <form onSubmit={send} className="mt-3 flex gap-2">
            <label htmlFor="msg" className="sr-only">Message</label>
            <input id="msg" className="input" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" />
            <button className="btn-primary" disabled={!body.trim()}>Send</button>
          </form>
        ) : <p className="mt-3 text-xs text-ink-500">Messaging is closed for this booking.</p>}
        <div className="mt-3 border-t border-stone-100 pt-2"><TrustActions reportedId={other.id} bookingId={b.id} tripId={t.id} /></div>
      </div>

      {canGiveFeedback(db, b, me!.id, now) && <Link to={`/bookings/${b.id}/feedback`} className="btn-accent w-full">How did the trip go?</Link>}
      {live && <button className="btn-danger w-full" onClick={() => setCancelOpen(true)}>{asDriver ? 'Cancel this passenger’s booking' : 'Cancel my booking'}</button>}

      <Modal open={cancelOpen} title="Cancel booking?" onClose={() => setCancelOpen(false)}>
        <div className="space-y-2 text-sm text-ink-700">
          <p>Pilot cancellation rules:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>You can cancel at any time. {other.displayName} will be notified.</li>
            <li>Cancelling an accepted booking less than {db.settings.lateCancelHours} hours before departure is recorded as a <b>late cancellation</b>.</li>
            <li>Repeated late cancellations or no-shows may lead to an account review.</li>
          </ul>
          {b.status === 'accepted' && lateWindow && <p className="rounded-lg bg-amber-50 p-2 text-amber-900">This will be recorded as a late cancellation.</p>}
        </div>
        <label htmlFor="cr" className="label mt-3">Reason (optional)</label>
        <input id="cr" className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex gap-2">
          <button className="btn-outline flex-1" onClick={() => setCancelOpen(false)}>Keep booking</button>
          <button className="btn-danger flex-1" onClick={() => { if (run((d, n) => cancelBooking(d, me!.id, b.id, reason, n), 'Booking cancelled.')) setCancelOpen(false); }}>Cancel booking</button>
        </div>
      </Modal>
    </div>
  );
}
