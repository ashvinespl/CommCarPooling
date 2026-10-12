import { useState } from 'react';
import { Link } from '../components/Link';
import { useApp } from '../state/AppState';
import { completedRideCount, getTrip, getUser, unblockUser, updateProfile } from '../mock/engine';
import { Avatar, PageHeader, PrivateBadge, StatusPill } from '../components/ui';
import { formatDateTime } from '../lib/time';
import { zoneById } from '../mock/zones';
import type { RolePref } from '../types';

export function Profile() {
  const { db, me, run, signInAs } = useApp();
  const u = me!;
  const [f, setF] = useState({ displayName: u.displayName, bio: u.bio ?? '', phone: u.phone ?? '', sharePhoneAfterAccept: u.sharePhoneAfterAccept, role: u.role });
  const [delReq, setDelReq] = useState(false);
  const history = [
    ...db.bookings.filter((b) => b.passengerId === u.id).map((b) => ({ id: b.id, when: getTrip(db, b.tripId)!.departureAt, label: `Passenger · ${zoneById(b.pickupZoneId).name} → ${zoneById(b.dropoffZoneId).name}`, status: b.status, to: `/bookings/${b.id}` })),
    ...db.trips.filter((t) => t.driverId === u.id).map((t) => ({ id: t.id, when: t.departureAt, label: `Driver · ${zoneById(t.stops[0]).name} → ${zoneById(t.stops[t.stops.length - 1]).name} (${t.seatsBooked}/${t.seatsTotal} booked)`, status: undefined, tripStatus: t.status, to: `/trips/${t.id}` })),
  ].sort((a, b) => b.when.localeCompare(a.when));
  const blocked = db.blocks.filter((x) => x.blockerId === u.id).map((x) => getUser(db, x.blockedId)!);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Profile" />
      <div className="card flex items-center gap-4">
        <Avatar user={u} size={64} />
        <div>
          <p className="text-lg font-semibold">{u.displayName}</p>
          <p className="text-sm text-ink-500">{completedRideCount(db, u.id)} completed rides · {u.driverDeclaredAt ? 'Driver declaration on file (self-declared)' : 'Passenger'}</p>
          <button className="mt-1 text-sm text-brand-700 underline" disabled title="Photo upload arrives in Stage 4">Add a photo (optional)</button>
        </div>
      </div>

      <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); run((d) => updateProfile(d, u.id, { ...f, phone: f.phone || undefined }), 'Profile saved.'); }}>
        <h2 className="h2">Public profile</h2>
        <div><label htmlFor="dn" className="label">Display name</label><input id="dn" className="input" maxLength={40} value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></div>
        <div><label htmlFor="bio" className="label">About you (optional)</label><textarea id="bio" rows={2} maxLength={280} className="input" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
        <div><label htmlFor="role" className="label">I want to…</label>
          <select id="role" className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as RolePref })}>
            <option value="passenger">Ride</option>
            <option value="driver" disabled={!u.driverDeclaredAt}>Drive</option>
            <option value="both" disabled={!u.driverDeclaredAt}>Both</option>
          </select>
          {!u.driverDeclaredAt && <p className="hint">To drive, <Link to="/driver-declaration" className="underline">complete the driver declaration</Link>.</p>}</div>
        <h2 className="h2 pt-2">Private details</h2>
        <p className="text-sm text-ink-700">Full name<PrivateBadge />: {u.fullName} · Email<PrivateBadge />: {u.email}</p>
        <div><label htmlFor="ph" className="label">Phone (optional)<PrivateBadge /></label><input id="ph" type="tel" className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={f.sharePhoneAfterAccept} onChange={(e) => setF({ ...f, sharePhoneAfterAccept: e.target.checked })} />
          Share my phone number with the other person after a booking is accepted, if they also choose to share theirs.</label>
        <button className="btn-primary">Save</button>
      </form>

      <div className="card">
        <h2 className="h2 mb-2">Trip & booking history</h2>
        {history.length === 0 ? <p className="text-sm text-ink-500">Nothing yet.</p> : (
          <ul className="divide-y divide-stone-100">
            {history.map((h) => (
              <li key={h.id}><Link to={h.to} className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-stone-50">
                <span><span className="block font-medium">{formatDateTime(h.when)}</span><span className="text-ink-500">{h.label}</span></span>
                {h.status ? <StatusPill status={h.status} /> : <span className="text-xs text-ink-500">{'tripStatus' in h ? h.tripStatus : ''}</span>}
              </Link></li>
            ))}
          </ul>
        )}
      </div>

      <div className="card space-y-2">
        <h2 className="h2">Blocked people</h2>
        {blocked.length === 0 ? <p className="text-sm text-ink-500">You haven’t blocked anyone.</p> : blocked.map((b) => (
          <div key={b.id} className="flex items-center justify-between text-sm"><span>{b.displayName}</span>
            <button className="btn-ghost min-h-[36px]" onClick={() => run((d) => unblockUser(d, u.id, b.id), 'Unblocked.')}>Unblock</button></div>
        ))}
      </div>

      <div className="card space-y-2 text-sm">
        <h2 className="h2">Account</h2>
        {delReq ? <p className="text-ink-700">Deletion request recorded. During the pilot, the team processes requests manually within 30 days and emails you to confirm.</p>
          : <button className="btn-danger" onClick={() => setDelReq(true)}>Request account deletion</button>}
        <button className="btn-ghost" onClick={() => signInAs(undefined)}>Log out</button>
      </div>
    </div>
  );
}
