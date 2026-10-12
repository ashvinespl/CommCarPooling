import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Link } from '../components/Link';
import { useApp } from '../state/AppState';
import { canSeePrivateDetails, completedRideCount, getTrip, getUser, isBlockedBetween, isOpen, requestSeat, seatsLeft } from '../mock/engine';
import { Avatar, Contribution, ContributionNotice, EmptyState, PageHeader, StatusPill, ZoneSelect } from '../components/ui';
import { TrustActions } from '../components/Trust';
import { formatDateTime, formatTime, relativeDayLabel } from '../lib/time';
import { plural } from '../lib/format';
import { zoneById, zoneMapUrl } from '../mock/zones';
import type { ZoneId } from '../types';

export function TripDetail() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { db, me, now, runWith, track } = useApp();
  const navigate = useNavigate();
  const trip = getTrip(db, id);
  const [pickup, setPickup] = useState<ZoneId | ''>(Number(params.get('pickup')) || trip?.stops[0] || '');
  const [dropoff, setDropoff] = useState<ZoneId | ''>(Number(params.get('dropoff')) || trip?.stops[trip.stops.length - 1] || '');
  const [seats, setSeats] = useState(1);
  const [message, setMessage] = useState('');
  const [started, setStarted] = useState(false);

  if (!trip || (me && isBlockedBetween(db, me.id, trip.driverId))) return <EmptyState title="Trip not found" action={<Link to="/search" className="btn-primary">Search trips</Link>} />;
  const driver = getUser(db, trip.driverId)!;
  const mine = me?.id === trip.driverId;
  const existing = me && db.bookings.find((b) => b.tripId === trip.id && b.passengerId === me.id && ['pending', 'accepted', 'completed'].includes(b.status));
  const showPrivate = canSeePrivateDetails(db, trip, me?.id);
  const open = isOpen(trip, now);
  const pickupIdx = pickup ? trip.stops.indexOf(pickup) : -1;
  const returnTrip = trip.returnTripId ? getTrip(db, trip.returnTripId) : undefined;

  const submit = () => {
    if (!me) { navigate(`/login?next=${encodeURIComponent(`/trips/${trip.id}?pickup=${pickup}&dropoff=${dropoff}`)}`); return; }
    const res = runWith((d, n) => requestSeat(d, me.id, { tripId: trip.id, pickup: pickup as ZoneId, dropoff: dropoff as ZoneId, seats, message }, n), 'Request sent! The driver will be notified.');
    if (res) { track('booking_requested'); navigate(`/bookings/${res.bookingId}`); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={`${zoneById(trip.stops[0]).name} → ${zoneById(trip.stops[trip.stops.length - 1]).name}`} back="/search">
        {relativeDayLabel(trip.departureAt, now)} · {formatTime(trip.departureAt)}
        {trip.status === 'cancelled' && <span className="ml-2 font-semibold text-red-700">Cancelled by driver: {trip.cancelledReason}</span>}
      </PageHeader>

      <div className="card">
        <h2 className="sr-only">Route</h2>
        <ol className="relative space-y-4 border-l-2 border-brand-200 pl-5">
          {trip.stops.map((z, i) => {
            const zone = zoneById(z);
            const inSegment = pickup && dropoff && i >= trip.stops.indexOf(pickup) && i <= trip.stops.indexOf(dropoff);
            return (
              <li key={z} className="relative">
                <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 ${inSegment ? 'border-brand-600 bg-brand-600' : 'border-stone-300 bg-white'}`} />
                <p className={`font-medium ${inSegment ? 'text-ink-900' : 'text-ink-500'}`}>{zone.name}
                  {i === 0 && <span className="ml-2 text-xs text-ink-500">departs {formatTime(trip.departureAt)}</span>}</p>
                <p className="text-xs text-ink-500">{zone.description} · <a className="underline" href={zoneMapUrl(zone)} target="_blank" rel="noreferrer">map</a></p>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-ink-500">Zones are approximate public areas. Exact meeting point is shared after the driver accepts.</p>
      </div>

      <div className="card grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-ink-500">Contribution</p><Contribution cents={trip.contributionCents} /></div>
        <div><p className="text-ink-500">Seats left</p><p className="font-semibold">{seatsLeft(trip)} of {trip.seatsTotal}</p></div>
        <div><p className="text-ink-500">Luggage</p><p>{trip.luggageOk ? 'Room for luggage' : 'Small bags only'}</p></div>
        <div><p className="text-ink-500">Trip type</p><p>{trip.tripType === 'round_trip' ? 'Has a return trip' : 'One-way'}</p></div>
        {trip.notes && <div className="col-span-2"><p className="text-ink-500">Driver’s notes</p><p>{trip.notes}</p></div>}
        {trip.accessibilityNotes && <div className="col-span-2"><p className="text-ink-500">Accessibility</p><p>{trip.accessibilityNotes}</p></div>}
        {returnTrip && <div className="col-span-2"><Link className="text-brand-700 underline" to={`/trips/${returnTrip.id}`}>See return trip · {formatDateTime(returnTrip.departureAt)}</Link></div>}
      </div>

      {showPrivate && (
        <div className="card border-brand-200 bg-brand-50 text-sm">
          <p className="font-semibold text-brand-900">Exact meeting point</p>
          <p>{trip.meetingPoint || 'Driver hasn’t added one yet — ask in messages.'}</p>
          <p className="mt-2 font-semibold text-brand-900">Vehicle</p>
          <p>{trip.vehicle || 'Not specified'}</p>
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 font-semibold">Driver</h2>
        {me ? (
          <div className="flex items-start gap-3">
            <Avatar user={driver} size={48} />
            <div className="flex-1">
              <p className="font-semibold">{driver.displayName}</p>
              <p className="text-xs text-ink-500">Member since {new Date(driver.createdAt).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })} · {plural(completedRideCount(db, driver.id), 'completed ride')}</p>
              <p className="text-xs text-ink-500">Licence & insurance: self-declared (not verified)</p>
              {driver.bio && <p className="mt-2 text-sm">{driver.bio}</p>}
            </div>
          </div>
        ) : <p className="text-sm text-ink-500"><Link to="/login" className="text-brand-700 underline">Sign in</Link> to see who’s driving.</p>}
        <div className="mt-3 border-t border-stone-100 pt-2"><TrustActions reportedId={driver.id} tripId={trip.id} /></div>
      </div>

      {mine ? (
        <Link to="/my-trips" className="btn-outline w-full">This is your trip · manage it</Link>
      ) : existing ? (
        <Link to={`/bookings/${existing.id}`} className="card flex items-center justify-between">
          <span>Your request</span><StatusPill status={existing.status} />
        </Link>
      ) : open && seatsLeft(trip) > 0 ? (
        <div className="card space-y-3" onFocus={() => { if (!started) { setStarted(true); track('booking_request_started'); } }}>
          <h2 className="h2">Request a seat</h2>
          <ZoneSelect id="bk-pickup" label="Your pickup zone" value={pickup} options={trip.stops.slice(0, -1)} onChange={(v) => { setPickup(v); if (dropoff && trip.stops.indexOf(dropoff) <= trip.stops.indexOf(v)) setDropoff(''); }} />
          <ZoneSelect id="bk-dropoff" label="Your drop-off zone" value={dropoff} options={trip.stops.slice(pickupIdx + 1)} onChange={setDropoff} />
          <div><label htmlFor="bk-seats" className="label">Seats</label>
            <select id="bk-seats" className="input" value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
              {Array.from({ length: Math.min(4, seatsLeft(trip)) }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
            </select></div>
          <div><label htmlFor="bk-msg" className="label">Message to driver (optional)</label>
            <textarea id="bk-msg" rows={2} maxLength={300} className="input" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. I'll have a small backpack" /></div>
          <ContributionNotice />
          <button className="btn-primary w-full" disabled={!pickup || !dropoff} onClick={submit}>{me ? 'Send request' : 'Sign in to request'}</button>
        </div>
      ) : (
        <EmptyState title={open ? 'This trip is full' : 'This trip is no longer open'} action={<Link to="/search" className="btn-outline">Find another trip</Link>} />
      )}
    </div>
  );
}
