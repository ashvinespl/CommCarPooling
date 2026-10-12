import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { Field, Modal, PageHeader, PrivateBadge } from '../components/ui';
import { PAGES } from './Info';
import { registerUser } from '../mock/engine';
import type { RolePref } from '../types';

export function Login() {
  const { db, signInAs } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next') || '/search';
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Log in" />
      <div className="card space-y-4">
        <Field label="Email" htmlFor="email"><input id="email" type="email" className="input" autoComplete="email" placeholder="you@example.com" /></Field>
        <Field label="Password" htmlFor="pw"><input id="pw" type="password" className="input" autoComplete="current-password" /></Field>
        <button className="btn-primary w-full" disabled title="Real login arrives in Stage 3">Log in</button>
        <p className="text-center text-xs text-ink-500">Real login arrives in Stage 3 (Supabase Auth). <Link to="#" className="underline">Forgot password?</Link></p>
      </div>
      <div className="card mt-4">
        <h2 className="h2 mb-2">Prototype: continue as a sample user</h2>
        <ul className="divide-y divide-stone-100">
          {db.users.map((u) => (
            <li key={u.id}>
              <button className="flex w-full items-center justify-between py-3 text-left hover:bg-stone-50"
                onClick={() => { signInAs(u.id); navigate(next); }}>
                <span><span className="font-medium">{u.displayName}</span> <span className="text-sm text-ink-500">· {u.isAdmin ? 'admin' : u.role}</span></span>
                <span aria-hidden>→</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-center text-sm">New here? <Link to={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-brand-700 underline">Create an account</Link></p>
    </div>
  );
}

export function SignUp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { track } = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent) => { e.preventDefault(); track('signup_started'); setSent(true); };
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Create your account" />
      {!sent ? (
        <form className="card space-y-4" onSubmit={submit}>
          <Field label="Email" htmlFor="su-email" hint="Used to log in and for trip notifications. Never shown to other users.">
            <input id="su-email" required type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label="Password" htmlFor="su-pw" hint="At least 8 characters.">
            <input id="su-pw" required minLength={8} type="password" className="input" autoComplete="new-password" />
          </Field>
          <button className="btn-primary w-full">Continue</button>
        </form>
      ) : (
        <div className="card space-y-3">
          <p className="h2">Check your email</p>
          <p className="text-sm text-ink-700">We sent a confirmation link to <strong>{email}</strong>. Not there? Check your spam folder.</p>
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Prototype: no email is actually sent.</p>
          <button className="btn-primary w-full" onClick={() => navigate(`/onboarding?email=${encodeURIComponent(email)}&next=${encodeURIComponent(params.get('next') || '/search')}`)}>
            I’ve confirmed my email
          </button>
        </div>
      )}
    </div>
  );
}

export function Onboarding() {
  const { runWith, signInAs, track } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [f, setF] = useState({ displayName: '', fullName: '', role: 'passenger' as RolePref, phone: '', age: false, terms: false, privacy: false, safety: false, driverDecl: false, source: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const isDriver = f.role !== 'passenger';
  const [policy, setPolicy] = useState<string | null>(null);
  const PolicyLink = ({ page, children }: { page: string; children: React.ReactNode }) => (
    <button type="button" className="underline" onClick={(e) => { e.preventDefault(); setPolicy(page); }}>{children}</button>
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = runWith((db, now) => registerUser(db, {
      email: params.get('email') || `new-${Date.now()}@example.test`, displayName: f.displayName, fullName: f.fullName,
      role: f.role, phone: f.phone, ageConfirmed: f.age, consents: f.terms && f.privacy && f.safety,
      driverDeclaration: f.driverDecl, acquisitionSource: f.source,
    }, now), 'Welcome to the pilot!');
    if (res) { signInAs(res.userId); track('signup_completed'); navigate(params.get('next') || '/search'); }
  };

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Set up your profile">Only your display name (and optional photo) is visible to other signed-in members.</PageHeader>
      <form className="card space-y-4" onSubmit={submit}>
        <Field label="Display name" htmlFor="dn" hint="First name and last initial, e.g. “Priya S.”">
          <input id="dn" required maxLength={40} className="input" value={f.displayName} onChange={(e) => set('displayName', e.target.value)} />
        </Field>
        <div>
          <label htmlFor="fn" className="label">Full name<PrivateBadge /></label>
          <input id="fn" required className="input" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" />
          <p className="hint">Only the pilot team sees this, and only to handle safety reports.</p>
        </div>
        <fieldset>
          <legend className="label">I want to…</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['passenger', 'driver', 'both'] as RolePref[]).map((r) => (
              <label key={r} className={`btn-outline cursor-pointer capitalize ${f.role === r ? 'border-brand-500 bg-brand-50 text-brand-700' : ''}`}>
                <input type="radio" name="role" className="sr-only" checked={f.role === r} onChange={() => set('role', r)} />
                {r === 'passenger' ? 'Ride' : r === 'driver' ? 'Drive' : 'Both'}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="ph" className="label">Phone (optional)<PrivateBadge /></label>
          <input id="ph" type="tel" className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" />
          <p className="hint">Never shown publicly. You can choose to share it with a driver or passenger after a booking is accepted.</p>
        </div>
        <Field label="How did you hear about us? (optional)" htmlFor="src">
          <select id="src" className="input" value={f.source} onChange={(e) => set('source', e.target.value)}>
            <option value="">Prefer not to say</option>
            {['Friend or family', 'Community Facebook group', 'Poster or flyer', 'Campus', 'Workplace', 'Other'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>

        <fieldset className="space-y-2 rounded-xl bg-stone-50 p-3 text-sm">
          <legend className="sr-only">Agreements</legend>
          <Check checked={f.age} onChange={(v) => set('age', v)}>I am 18 or older.</Check>
          <Check checked={f.terms} onChange={(v) => set('terms', v)}>I agree to the <PolicyLink page="terms">Terms of Use</PolicyLink>.</Check>
          <Check checked={f.privacy} onChange={(v) => set('privacy', v)}>I have read the <PolicyLink page="privacy">Privacy Notice</PolicyLink>.</Check>
          <Check checked={f.safety} onChange={(v) => set('safety', v)}>I will follow the <PolicyLink page="safety">Community Safety Rules</PolicyLink>.</Check>
        </fieldset>
        {isDriver && <DriverDeclarationChecks checked={f.driverDecl} onChange={(v) => set('driverDecl', v)} />}
        <button className="btn-primary w-full">Finish</button>
      </form>
      <Modal open={!!policy} title={policy ? PAGES[policy].title : ''} onClose={() => setPolicy(null)}>
        <div className="max-h-[60vh] overflow-y-auto text-sm leading-relaxed text-ink-700">{policy && PAGES[policy].body}</div>
      </Modal>
    </div>
  );
}

export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function DriverDeclarationChecks({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-semibold">Driver declaration</p>
      <ul className="my-2 list-disc space-y-1 pl-5 text-ink-700">
        <li>I hold a valid driver’s licence for the vehicle I drive.</li>
        <li>The vehicle is insured, and I have checked that my coverage suits carpooling with cost-sharing.</li>
        <li>I only offer seats on personal trips I’m already making. I am not providing a commercial ride service.</li>
        <li>Contributions I propose only cover trip costs (fuel, parking, wear). I don’t make a profit.</li>
      </ul>
      <Check checked={checked} onChange={onChange}>I confirm all of the above.</Check>
      <p className="mt-2 text-xs text-ink-500">This is a self-declaration. The pilot does not verify licences or insurance.</p>
    </div>
  );
}
