import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { addRideRequest } from '../mock/engine';
import { Field, PageHeader, ZoneSelect } from '../components/ui';
import { addDays, todayVancouver } from '../lib/time';
import type { ZoneId } from '../types';

export function RideRequestPage() {
  const { me, now, run, track } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [f, setF] = useState({
    origin: (Number(params.get('origin')) || '') as ZoneId | '', destination: (Number(params.get('destination')) || '') as ZoneId | '',
    date: params.get('date') || addDays(todayVancouver(now), 1), earliest: '', latest: '', recurring: false, notes: '',
  });
  const submit = () => {
    if (!f.origin || !f.destination) return;
    const ok = run((d, n) => addRideRequest(d, me!.id, { originZoneId: f.origin as ZoneId, destinationZoneId: f.destination as ZoneId, desiredDate: f.date, earliest: f.earliest || undefined, latest: f.latest || undefined, isRecurring: f.recurring, notes: f.notes || undefined }, n),
      'Thanks! We’ll use this to recruit drivers on popular routes.');
    if (ok) { track('ride_request_submitted'); navigate('/search'); }
  };
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Tell us the ride you need">We can’t promise a match. During the pilot we use these requests to find drivers for popular routes and times.</PageHeader>
      <div className="card space-y-3">
        <ZoneSelect id="o" label="From" value={f.origin} onChange={(v) => setF({ ...f, origin: v })} />
        <ZoneSelect id="d" label="To" value={f.destination} exclude={f.origin || undefined} onChange={(v) => setF({ ...f, destination: v })} />
        <Field label="Date" htmlFor="dt"><input id="dt" type="date" className="input" value={f.date} min={todayVancouver(now)} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Earliest" htmlFor="e"><input id="e" type="time" className="input" value={f.earliest} onChange={(e) => setF({ ...f, earliest: e.target.value })} /></Field>
          <Field label="Latest" htmlFor="l"><input id="l" type="time" className="input" value={f.latest} onChange={(e) => setF({ ...f, latest: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.checked })} /> I make this trip regularly</label>
        <Field label="Notes (optional)" htmlFor="n"><textarea id="n" rows={2} maxLength={300} className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <button className="btn-primary w-full" disabled={!f.origin || !f.destination} onClick={submit}>Submit request</button>
      </div>
    </div>
  );
}
