import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { searchTrips, seatsLeft, getUser } from '../mock/engine';
import { Avatar, Contribution, EmptyState, PageHeader, RouteLine, ZoneSelect } from '../components/ui';
import { addDays, formatTime, relativeDayLabel, todayVancouver, vancouverToIso } from '../lib/time';
import { plural } from '../lib/format';
import type { Trip, ZoneId } from '../types';

export function Search() {
  const { db, me, now, track } = useApp();
  const [params, setParams] = useSearchParams();
  const today = todayVancouver(now);
  const pickup = Number(params.get('pickup')) || '';
  const dropoff = Number(params.get('dropoff')) || '';
  const date = params.get('date') || addDays(today, 1);
  const earliest = params.get('earliest') || '';
  const latest = params.get('latest') || '';
  const max = params.get('max') || '';
  const seats = Number(params.get('seats') || 1);
  const [showFilters, setShowFilters] = useState(false);

  const update = (patch: Record<string, string | number | ''>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === '' || v == null ? next.delete(k) : next.set(k, String(v))));
    setParams(next, { replace: true });
  };

  const ready = pickup !== '' && dropoff !== '';
  const results = useMemo(() => ready ? searchTrips(db, me?.id, {
    pickup: pickup as ZoneId, dropoff: dropoff as ZoneId, date, earliest: earliest || undefined, latest: latest || undefined,
    maxContributionCents: max ? Number(max) * 100 : undefined, seats,
  }, now) : [], [db, me?.id, pickup, dropoff, date, earliest, latest, max, seats, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    track('search_performed');
    if (results.length === 0) track('search_no_results');
  }, [pickup, dropoff, date, earliest, latest, max, seats]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilters = [earliest, latest, max].filter(Boolean).length + (seats > 1 ? 1 : 0);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Find a ride" />
      <div className="card space-y-3">
        <ZoneSelect id="pickup" label="Pickup zone" value={pickup} onChange={(v) => update({ pickup: v })} />
        <div className="flex justify-center">
          <button type="button" className="btn-ghost min-h-[36px] text-sm" aria-label="Swap pickup and drop-off"
            onClick={() => update({ pickup: dropoff, dropoff: pickup })}>⇅ Swap</button>
        </div>
        <ZoneSelect id="dropoff" label="Drop-off zone" value={dropoff} exclude={pickup || undefined} onChange={(v) => update({ dropoff: v })} />
        <div>
          <span className="label">Date</span>
          <div className="flex flex-wrap gap-2">
            {[0, 1].map((d) => {
              const v = addDays(today, d);
              return <button key={d} type="button" onClick={() => update({ date: v })}
                className={`btn-outline min-h-[40px] ${date === v ? 'border-brand-500 bg-brand-50 text-brand-700' : ''}`}>{d ? 'Tomorrow' : 'Today'}</button>;
            })}
            <input aria-label="Pick a date" type="date" className="input w-auto flex-1" value={date} min={today} max={addDays(today, 30)} onChange={(e) => update({ date: e.target.value })} />
          </div>
        </div>
        <button type="button" className="text-sm font-medium text-brand-700" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          {showFilters ? 'Hide filters' : `Filters${activeFilters ? ` (${activeFilters})` : ''}`}
        </button>
        {showFilters && (
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3">
            <div><label htmlFor="earliest" className="label">Leaving after</label><input id="earliest" type="time" className="input" value={earliest} onChange={(e) => update({ earliest: e.target.value })} /></div>
            <div><label htmlFor="latest" className="label">Leaving before</label><input id="latest" type="time" className="input" value={latest} onChange={(e) => update({ latest: e.target.value })} /></div>
            <div><label htmlFor="max" className="label">Max contribution ($)</label><input id="max" type="number" min={0} max={15} inputMode="numeric" className="input" value={max} onChange={(e) => update({ max: e.target.value })} /></div>
            <div><label htmlFor="seats" className="label">Seats needed</label>
              <select id="seats" className="input" value={seats} onChange={(e) => update({ seats: e.target.value })}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select></div>
            <button type="button" className="col-span-2 text-left text-sm text-ink-500 underline" onClick={() => update({ earliest: '', latest: '', max: '', seats: '' })}>Clear filters</button>
          </div>
        )}
      </div>

      <section className="mt-6 space-y-3" aria-live="polite">
        {!ready && <QuickRoutes onPick={(p, d) => update({ pickup: p, dropoff: d })} />}
        {ready && results.length > 0 && <p className="text-sm text-ink-500">{plural(results.length, 'trip')} · {relativeDayLabel(vancouverToIso(date, '12:00'), now)}</p>}
        {ready && results.map((t) => <TripCard key={t.id} trip={t} pickup={pickup as ZoneId} dropoff={dropoff as ZoneId} />)}
        {ready && results.length === 0 && (
          <EmptyState title="No trips match yet" action={
            <Link className="btn-accent" to={`/ride-request?origin=${pickup}&destination=${dropoff}&date=${date}`}>Tell us the ride you need</Link>
          }>
            This is a small pilot, so trips are limited. Try another date or nearby zone, or tell us your trip. We use these requests to find drivers.
          </EmptyState>
        )}
      </section>
    </div>
  );
}

function QuickRoutes({ onPick }: { onPick: (p: ZoneId, d: ZoneId) => void }) {
  const routes: [ZoneId, ZoneId, string][] = [[4, 10, 'Newton → White Rock'], [10, 1, 'White Rock → Surrey Central'], [3, 8, 'Guildford → Morgan Crossing'], [9, 2, 'Semiahmoo → King George']];
  return (
    <div>
      <p className="mb-2 text-sm text-ink-500">Popular routes in the pilot</p>
      <div className="flex flex-wrap gap-2">
        {routes.map(([p, d, label]) => <button key={label} className="btn-outline min-h-[40px]" onClick={() => onPick(p, d)}>{label}</button>)}
      </div>
    </div>
  );
}

export function TripCard({ trip, pickup, dropoff }: { trip: Trip; pickup?: ZoneId; dropoff?: ZoneId }) {
  const { db, me, now } = useApp();
  const driver = getUser(db, trip.driverId)!;
  const qs = pickup && dropoff ? `?pickup=${pickup}&dropoff=${dropoff}` : '';
  return (
    <Link to={`/trips/${trip.id}${qs}`} className="card block transition hover:border-brand-200 hover:shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-bold">{formatTime(trip.departureAt)}</p>
          <p className="text-xs text-ink-500">{relativeDayLabel(trip.departureAt, now)}</p>
        </div>
        <div className="text-right">
          <Contribution cents={trip.contributionCents} className="block" />
          <p className="text-xs text-ink-500">{plural(seatsLeft(trip), 'seat')} left</p>
        </div>
      </div>
      <div className="mt-3"><RouteLine stops={trip.stops} highlight={pickup && dropoff ? [pickup, dropoff] : undefined} /></div>
      <div className="mt-3 flex items-center gap-2 text-sm text-ink-700">
        {me ? <><Avatar user={driver} size={28} /><span>{driver.displayName}</span></> : <span className="text-ink-500">Sign in to see the driver</span>}
        {trip.luggageOk && <span className="ml-auto rounded bg-stone-100 px-2 py-0.5 text-xs">Luggage OK</span>}
        {trip.tripType === 'round_trip' && <span className={`${trip.luggageOk ? '' : 'ml-auto'} rounded bg-stone-100 px-2 py-0.5 text-xs`}>Return trip available</span>}
      </div>
    </Link>
  );
}
