import { useEffect } from 'react';
import { Link } from '../components/Link';
import { useApp } from '../state/AppState';
import { FooterLinks } from '../components/Layout';

const steps = [
  { title: 'Drivers share a trip they’re already making', body: 'Pick public pickup zones along your route, your departure time, seats and a proposed contribution toward trip costs.' },
  { title: 'Passengers find a trip heading their way', body: 'Search by pickup zone, drop-off zone and date. Request a seat and add a short note.' },
  { title: 'The driver accepts, then you coordinate', body: 'Once accepted, you both see the exact meeting point and can message in the app. Settle the contribution directly.' },
];

export function Landing() {
  const { track } = useApp();
  useEffect(() => { track('landing_view'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-stone-50 px-4 pb-12 pt-10 md:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
            Community pilot · Surrey ↔ South Surrey ↔ White Rock
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 md:text-5xl">Share the seats already on the road.</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-700">
            Find neighbours heading the same way between Surrey and White Rock, and share the cost of a trip they were making anyway.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/search" className="btn-primary px-6 text-base">Find a ride</Link>
            <Link to="/offer" className="btn-outline px-6 text-base">Offer a seat</Link>
          </div>
          <p className="mt-4 text-xs text-ink-500">A four-week community pilot. Rides depend on what neighbours publish, so availability isn’t guaranteed.</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="h2 mb-4 text-center">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="card">
              <span className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{i + 1}</span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-700">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-10 md:grid-cols-2">
        <div className="card">
          <h2 className="h2">How contributions work</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
            <li>Drivers propose a contribution toward trip costs (fuel, parking, wear). It’s <strong>not a fare</strong>.</li>
            <li>The pilot caps contributions, and drivers can ask for nothing at all.</li>
            <li>You settle directly with each other. We don’t process payments or take a commission.</li>
          </ul>
          <Link to="/info/contributions" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">Read more</Link>
        </div>
        <div className="card">
          <h2 className="h2">Safety: what we do and don’t do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
            <li>Pickups happen at public zones, never at home addresses.</li>
            <li>The exact meeting point is only shown once a driver accepts you.</li>
            <li>You can message in the app, and report or block anyone.</li>
            <li><strong>We don’t verify identity, licences or insurance.</strong> Drivers self-declare. Use your judgement.</li>
            <li>We don’t provide insurance. Vehicle insurance is each driver’s own responsibility.</li>
            <li>Drivers may decline a request or end a ride at any time.</li>
            <li>Everyone pledges to treat drivers and passengers with respect.</li>
            <li><strong>In an emergency, call 911.</strong></li>
          </ul>
          <Link to="/info/safety" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">Community Safety Rules</Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="card flex flex-col items-center gap-3 bg-brand-700 py-8 text-center text-white">
          <h2 className="text-xl font-bold">Making a regular trip? Help us test the idea.</h2>
          <p className="max-w-lg text-sm text-brand-100">We’re running a four-week pilot to learn whether community carpooling works here. Your feedback shapes what comes next.</p>
          <Link to="/signup" className="btn bg-white text-brand-700 hover:bg-brand-50">Join the pilot</Link>
        </div>
        <div className="mt-8 text-xs text-ink-500 md:hidden"><FooterLinks /></div>
      </section>
    </div>
  );
}
