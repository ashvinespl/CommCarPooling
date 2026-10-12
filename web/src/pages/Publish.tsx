import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { declareDriver, linkRoundTrip, publishTrip } from '../mock/engine';
import { Contribution, ContributionNotice, Field, PageHeader, RouteLine, ZoneSelect } from '../components/ui';
import { DriverDeclarationChecks } from './Auth';
import { ZONES } from '../mock/zones';
import { addDays, formatDateTime, todayVancouver, vancouverToIso } from '../lib/time';
import { money } from '../lib/format';
import type { ZoneId } from '../types';

const STEPS = ['Route', 'When & seats', 'Contribution', 'Details', 'Review'];

export function DriverDeclaration() {
  const { me, run } = useApp();
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Before you offer seats" />
      <div className="card space-y-4">
        <DriverDeclarationChecks checked={ok} onChange={setOk} />
        <button className="btn-primary w-full" disabled={!ok} onClick={() => { if (run((db, now) => declareDriver(db, me!.id, now), 'Thanks! You can now offer seats.')) navigate('/offer'); }}>Continue</button>
      </div>
    </div>
  );
}

export function Publish() {
  const { me, db, now, runWith, run, track } = useApp();
  const navigate = useNavigate();
  const published = useRef(false);
  const [step, setStep] = useState(0);
  const tomorrow = addDays(todayVancouver(now), 1);
  const [f, setF] = useState({
    origin: '' as ZoneId | '', destination: '' as ZoneId | '', via: [] as ZoneId[], date: tomorrow, time: '07:30',
    seats: 2, contribution: '5', luggageOk: false, notes: '', accessibilityNotes: '', meetingPoint: '', vehicle: '',
    addReturn: false, returnTime: '17:00',
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    track('publish_started');
    return () => { if (!published.current) track('publish_abandoned'); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me!.driverDeclaredAt) return <Navigate to="/driver-declaration" replace />;

  const cap = db.settings.maxContributionCents;
  const cents = Math.round(Number(f.contribution || 0) * 100);
  const stops = [f.origin, ...f.via, f.destination].filter(Boolean) as ZoneId[];
  const canNext = [
    f.origin !== '' && f.destination !== '' && f.origin !== f.destination,
    !!f.date && !!f.time && f.seats >= 1,
    cents >= 0 && cents <= cap,
    true, true,
  ][step];

  const toggleVia = (z: ZoneId) => set('via', f.via.includes(z) ? f.via.filter((x) => x !== z) : [...f.via, z]);

  const submit = () => {
    const base = { via: f.via, seats: f.seats, contributionCents: cents, luggageOk: f.luggageOk, notes: f.notes, accessibilityNotes: f.accessibilityNotes, meetingPoint: f.meetingPoint, vehicle: f.vehicle };
    const out = runWith((d, n) => publishTrip(d, me!.id, { ...base, origin: f.origin as ZoneId, destination: f.destination as ZoneId, departureAt: vancouverToIso(f.date, f.time) }, n));
    if (!out) return;
    published.current = true;
    track('trip_published');
    if (f.addReturn) {
      const back = runWith((d, n) => publishTrip(d, me!.id, { ...base, via: [...f.via].reverse(), origin: f.destination as ZoneId, destination: f.origin as ZoneId, departureAt: vancouverToIso(f.date, f.returnTime), meetingPoint: '' }, n));
      if (back) run((d) => linkRoundTrip(d, me!.id, out.tripId, back.tripId));
    }
    navigate(`/trips/${out.tripId}`);
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Offer a seat">Share a trip you’re already making.</PageHeader>
      <ol className="mb-4 flex gap-1" aria-label="Progress">
        {STEPS.map((s, i) => <li key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-600' : 'bg-stone-200'}`} aria-current={i === step ? 'step' : undefined}><span className="sr-only">{s}</span></li>)}
      </ol>
      <p className="mb-2 text-sm font-semibold text-ink-500">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>

      <div className="card space-y-4">
        {step === 0 && <>
          <ZoneSelect id="origin" label="Starting zone" value={f.origin} onChange={(v) => { set('origin', v); set('via', f.via.filter((x) => x !== v)); }} />
          <ZoneSelect id="destination" label="Destination zone" value={f.destination} exclude={f.origin || undefined} onChange={(v) => { set('destination', v); set('via', f.via.filter((x) => x !== v)); }} />
          <fieldset>
            <legend className="label">Zones you pass on the way (optional)</legend>
            <p className="hint mb-2">Tap in the order you pass them. Passengers along your route can then find you.</p>
            <div className="flex flex-wrap gap-2">
              {ZONES.filter((z) => z.id !== f.origin && z.id !== f.destination).map((z) => {
                const idx = f.via.indexOf(z.id);
                return <button type="button" key={z.id} onClick={() => toggleVia(z.id)} aria-pressed={idx >= 0}
                  className={`btn-outline min-h-[36px] text-xs ${idx >= 0 ? 'border-brand-500 bg-brand-50 text-brand-700' : ''}`}>{idx >= 0 && <b>{idx + 1}.</b>} {z.name}</button>;
              })}
            </div>
          </fieldset>
          {stops.length >= 2 && <div className="rounded-xl bg-stone-50 p-3"><RouteLine stops={stops} /></div>}
        </>}

        {step === 1 && <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="date"><input id="date" type="date" className="input" min={todayVancouver(now)} max={addDays(todayVancouver(now), db.settings.maxDaysAhead)} value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Departure time" htmlFor="time"><input id="time" type="time" className="input" value={f.time} onChange={(e) => set('time', e.target.value)} /></Field>
          </div>
          <Field label="Seats available" htmlFor="seats">
            <div className="flex gap-2">{Array.from({ length: db.settings.maxSeats }, (_, i) => i + 1).map((n) => (
              <button type="button" key={n} onClick={() => set('seats', n)} aria-pressed={f.seats === n}
                className={`btn-outline flex-1 ${f.seats === n ? 'border-brand-500 bg-brand-50 text-brand-700' : ''}`}>{n}</button>))}</div>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.addReturn} onChange={(e) => set('addReturn', e.target.checked)} /> Add a return trip the same day</label>
          {f.addReturn && <Field label="Return departure time" htmlFor="rtime"><input id="rtime" type="time" className="input" value={f.returnTime} onChange={(e) => set('returnTime', e.target.value)} /></Field>}
        </>}

        {step === 2 && <>
          <Field label="Proposed contribution per passenger (CAD)" htmlFor="contrib" hint={`Pilot cap: ${money(cap)}. Enter 0 to offer the seat for free.`}>
            <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500">$</span>
              <input id="contrib" type="number" inputMode="decimal" min={0} max={cap / 100} step="0.5" className="input pl-7" value={f.contribution} onChange={(e) => set('contribution', e.target.value)} /></div>
          </Field>
          {cents > cap && <p role="alert" className="text-sm text-red-700">That’s above the pilot cap of {money(cap)}.</p>}
          <div className="rounded-xl border border-stone-200 p-3 text-sm">
            <p className="font-semibold">Cost-recovery guide</p>
            <p className="text-ink-700">Contributions should only cover your share of trip costs, such as fuel, parking and wear. The suggested per-km guide will be added after the pilot’s legal and insurance review.</p>
          </div>
          <ContributionNotice />
        </>}

        {step === 3 && <>
          <Field label="Exact meeting point (optional)" htmlFor="mp" hint="Only shown to passengers you accept. Pick a public, legal place to stop.">
            <input id="mp" className="input" maxLength={300} value={f.meetingPoint} onChange={(e) => set('meetingPoint', e.target.value)} placeholder="e.g. Newton Exchange, by the bike racks" />
          </Field>
          <Field label="Vehicle description (optional)" htmlFor="veh" hint="Only shown to accepted passengers, so they can find you.">
            <input id="veh" className="input" maxLength={100} value={f.vehicle} onChange={(e) => set('vehicle', e.target.value)} placeholder="e.g. Silver Toyota Corolla" />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.luggageOk} onChange={(e) => set('luggageOk', e.target.checked)} /> Room for luggage</label>
          <Field label="Notes for passengers (optional)" htmlFor="notes"><textarea id="notes" rows={2} maxLength={500} className="input" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          <Field label="Accessibility notes (optional)" htmlFor="acc"><textarea id="acc" rows={2} maxLength={300} className="input" value={f.accessibilityNotes} onChange={(e) => set('accessibilityNotes', e.target.value)} placeholder="e.g. Higher SUV seat; can fit a folded walker" /></Field>
        </>}

        {step === 4 && <div className="space-y-2 text-sm">
          <RouteLine stops={stops} />
          <p><b>Departs:</b> {formatDateTime(vancouverToIso(f.date, f.time))}</p>
          {f.addReturn && <p><b>Return:</b> {formatDateTime(vancouverToIso(f.date, f.returnTime))}</p>}
          <p><b>Seats:</b> {f.seats}</p>
          <p><b>Contribution:</b> <Contribution cents={cents} /></p>
          {f.meetingPoint && <p><b>Meeting point:</b> {f.meetingPoint} <span className="text-ink-500">(accepted passengers only)</span></p>}
          {f.notes && <p><b>Notes:</b> {f.notes}</p>}
        </div>}

        <div className="flex gap-2 pt-2">
          {step > 0 && <button type="button" className="btn-outline flex-1" onClick={() => setStep(step - 1)}>Back</button>}
          {step < STEPS.length - 1
            ? <button type="button" className="btn-primary flex-1" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</button>
            : <button type="button" className="btn-primary flex-1" onClick={submit}>Publish trip</button>}
        </div>
      </div>
    </div>
  );
}
