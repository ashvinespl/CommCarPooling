import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { canGiveFeedback, getBooking, getTrip, submitFeedback } from '../mock/engine';
import { PageHeader } from '../components/ui';
import { formatDateTime } from '../lib/time';
import type { RideOutcome, Settlement } from '../types';

function Choice<T extends string>({ name, value, options, onChange }: { name: string; value?: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <label key={v} className={`btn-outline min-h-[40px] cursor-pointer text-sm ${value === v ? 'border-brand-500 bg-brand-50 text-brand-700' : ''}`}>
          <input type="radio" name={name} className="sr-only" checked={value === v} onChange={() => onChange(v)} />{l}
        </label>
      ))}
    </div>
  );
}

export function Survey() {
  const { id = '' } = useParams();
  const { db, me, now, run, track } = useApp();
  const navigate = useNavigate();
  const [outcome, setOutcome] = useState<RideOutcome>();
  const [settled, setSettled] = useState<Settlement>();
  const [feltSafe, setFeltSafe] = useState<'yes' | 'no'>();
  const [rating, setRating] = useState<number>();
  const [minutes, setMinutes] = useState('');
  const [alt, setAlt] = useState('');
  const [altCost, setAltCost] = useState('');
  const [again, setAgain] = useState<'yes' | 'no'>();
  const [comments, setComments] = useState('');
  const b = getBooking(db, id);
  if (!b || !canGiveFeedback(db, b, me!.id, now)) return <Navigate to="/bookings" replace />;
  const t = getTrip(db, b.tripId)!;

  const submit = () => {
    const ok = run((d, n) => submitFeedback(d, me!.id, b.id, {
      outcome: outcome!, settled, rating, feltSafe: feltSafe ? feltSafe === 'yes' : undefined,
      minutesSaved: minutes ? Number(minutes) : undefined, alternativeMode: alt || undefined,
      alternativeCostCents: altCost ? Math.round(Number(altCost) * 100) : undefined,
      wouldUseAgain: again ? again === 'yes' : undefined, comments: comments || undefined,
    }, n), 'Thanks for your feedback!');
    if (ok) {
      track('feedback_submitted');
      navigate(outcome !== 'completed' || feltSafe === 'no' ? `/bookings/${b.id}?report=1` : '/bookings');
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="How did your trip go?">{formatDateTime(t.departureAt)} · Your answers are private to the pilot team.</PageHeader>
      <div className="card space-y-5">
        <fieldset><legend className="label">Did the ride happen?</legend>
          <Choice name="o" value={outcome} onChange={setOutcome} options={[['completed', 'Yes'], ['driver_no_show', 'Driver didn’t show'], ['passenger_no_show', 'Passenger didn’t show'], ['cancelled', 'It was cancelled'], ['other', 'Other']]} /></fieldset>
        {outcome === 'completed' && <>
          <fieldset><legend className="label">Was the contribution settled between you?</legend>
            <Choice name="s" value={settled} onChange={setSettled} options={[['settled', 'Yes'], ['partially', 'Partly'], ['not_settled', 'No'], ['waived', 'Driver waived it'], ['not_applicable', 'N/A']]} /></fieldset>
          <fieldset><legend className="label">Did you feel safe?</legend>
            <Choice name="fs" value={feltSafe} onChange={setFeltSafe} options={[['yes', 'Yes'], ['no', 'No']]} /></fieldset>
          <fieldset><legend className="label">Overall experience</legend>
            <div className="flex gap-2">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} aria-label={`${n} of 5`} aria-pressed={rating === n} onClick={() => setRating(n)} className={`btn-outline h-11 w-11 p-0 ${rating && n <= rating ? 'border-accent-500 bg-amber-50 text-accent-600' : ''}`}>★</button>)}</div></fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="alt" className="label">Otherwise I’d have…</label>
              <select id="alt" className="input" value={alt} onChange={(e) => setAlt(e.target.value)}>
                <option value="">Choose…</option><option value="bus">Taken the bus</option><option value="skytrain_bus">SkyTrain + bus</option><option value="taxi_ridehail">Taxi / ride-hail</option><option value="own_car">Driven alone</option><option value="walk_bike">Walked / biked</option><option value="not_travel">Not travelled</option><option value="other">Other</option>
              </select></div>
            <div><label htmlFor="altc" className="label">…costing about ($)</label><input id="altc" type="number" min={0} inputMode="decimal" className="input" value={altCost} onChange={(e) => setAltCost(e.target.value)} /></div>
          </div>
          <div><label htmlFor="min" className="label">Minutes saved compared with your usual way (negative if slower)</label><input id="min" type="number" min={-240} max={240} className="input" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
          <fieldset><legend className="label">Would you use this again?</legend>
            <Choice name="a" value={again} onChange={setAgain} options={[['yes', 'Yes'], ['no', 'No']]} /></fieldset>
        </>}
        <div><label htmlFor="cm" className="label">Anything else? (optional)</label><textarea id="cm" rows={3} maxLength={1000} className="input" value={comments} onChange={(e) => setComments(e.target.value)} /></div>
        <button className="btn-primary w-full" disabled={!outcome} onClick={submit}>Submit</button>
      </div>
    </div>
  );
}
