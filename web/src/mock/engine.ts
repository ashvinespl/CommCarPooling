// Mock "backend" for the Stage 2 prototype. Each function mirrors a database
// function in docs/schema/proposed_schema.sql and enforces the same rules, so
// the prototype behaves like the real system. Functions are pure: they take a
// Db and return a new Db (plus a result), which keeps them easy to unit-test.

import type {
  Booking, BookingStatus, Db, Feedback, Report, ReportCategory, ReportStatus,
  RideOutcome, RolePref, Settlement, Trip, User, ZoneId,
} from '../types';
import { vancouverDate, vancouverTime } from '../lib/time';

export class EngineError extends Error {}

const fail = (msg: string): never => { throw new EngineError(msg); };
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const clone = (db: Db): Db => structuredClone(db);
const nowIso = (now: Date) => now.toISOString();

// ---------------------------------------------------------------- lookups
export const getUser = (db: Db, id: string) => db.users.find((u) => u.id === id);
export const getTrip = (db: Db, id: string) => db.trips.find((t) => t.id === id);
export const getBooking = (db: Db, id: string) => db.bookings.find((b) => b.id === id);
export const seatsLeft = (t: Trip) => t.seatsTotal - t.seatsBooked;

export const isBlockedBetween = (db: Db, a: string, b: string) =>
  db.blocks.some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));

const requireActive = (db: Db, userId: string | undefined): User => {
  const u = userId ? getUser(db, userId) : undefined;
  if (!u) return fail('Please sign in first.');
  if (u.status !== 'active') return fail('Your account is suspended. Contact the pilot team for help.');
  return u;
};

/** Trip passes pickup BEFORE drop-off. */
export function tripMatches(t: Trip, pickup: ZoneId, dropoff: ZoneId): boolean {
  const i = t.stops.indexOf(pickup);
  const j = t.stops.indexOf(dropoff);
  return i >= 0 && j > i;
}

export function isOpen(t: Trip, now: Date): boolean {
  return t.status === 'scheduled' && new Date(t.departureAt) > now;
}

/** Driver, accepted/completed passenger or admin can see exact meeting point and vehicle. */
export function canSeePrivateDetails(db: Db, t: Trip, viewerId?: string): boolean {
  if (!viewerId) return false;
  if (t.driverId === viewerId || getUser(db, viewerId)?.isAdmin) return true;
  return db.bookings.some((b) => b.tripId === t.id && b.passengerId === viewerId && (b.status === 'accepted' || b.status === 'completed'));
}

export function completedRideCount(db: Db, userId: string): number {
  const asDriver = db.bookings.filter((b) => b.status === 'completed' && getTrip(db, b.tripId)?.driverId === userId).length;
  const asPassenger = db.bookings.filter((b) => b.status === 'completed' && b.passengerId === userId).length;
  return asDriver + asPassenger;
}

// ---------------------------------------------------------------- search
export interface SearchQuery {
  pickup: ZoneId; dropoff: ZoneId; date: string;
  earliest?: string; latest?: string; maxContributionCents?: number; seats?: number;
}

export function searchTrips(db: Db, viewerId: string | undefined, q: SearchQuery, now: Date): Trip[] {
  return db.trips
    .filter((t) => isOpen(t, now))
    .filter((t) => tripMatches(t, q.pickup, q.dropoff))
    .filter((t) => vancouverDate(t.departureAt) === q.date)
    .filter((t) => !q.earliest || vancouverTime(t.departureAt) >= q.earliest)
    .filter((t) => !q.latest || vancouverTime(t.departureAt) <= q.latest)
    .filter((t) => q.maxContributionCents == null || t.contributionCents <= q.maxContributionCents)
    .filter((t) => seatsLeft(t) >= (q.seats ?? 1))
    .filter((t) => !viewerId || (t.driverId !== viewerId && !isBlockedBetween(db, viewerId, t.driverId)))
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt));
}

// ---------------------------------------------------------------- accounts
export interface RegistrationInput {
  email: string; displayName: string; fullName: string; role: RolePref; phone?: string;
  ageConfirmed: boolean; consents: boolean; driverDeclaration: boolean; acquisitionSource?: string;
}

export function registerUser(db: Db, input: RegistrationInput, now: Date): { db: Db; userId: string } {
  if (!input.ageConfirmed) fail('You must be 18 or older to use the pilot.');
  if (!input.consents) fail('Please accept the Terms, Privacy Notice and Community Safety Rules.');
  if (!input.displayName.trim() || input.displayName.length > 40) fail('Display name must be 1–40 characters.');
  if (!input.fullName.trim()) fail('Full name is required (kept private).');
  if (input.role !== 'passenger' && !input.driverDeclaration) fail('Drivers must accept the driver declaration.');
  if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) fail('An account with this email already exists.');
  const next = clone(db);
  const id = uid('u');
  const palette = ['#2b8a62', '#3b6fb6', '#9a4fb0', '#c4721a', '#b63b5c', '#1f6f50'];
  next.users.push({
    id, email: input.email, displayName: input.displayName.trim(), fullName: input.fullName.trim(),
    phone: input.phone || undefined, sharePhoneAfterAccept: false, role: input.role,
    avatarColor: palette[next.users.length % palette.length], createdAt: nowIso(now),
    driverDeclaredAt: input.driverDeclaration ? nowIso(now) : undefined,
    status: 'active', isAdmin: false, acquisitionSource: input.acquisitionSource || undefined,
  });
  return { db: next, userId: id };
}

export function declareDriver(db: Db, userId: string, now: Date): Db {
  requireActive(db, userId);
  const next = clone(db);
  const u = getUser(next, userId)!;
  u.driverDeclaredAt = nowIso(now);
  if (u.role === 'passenger') u.role = 'both';
  return next;
}

export function updateProfile(db: Db, userId: string, patch: Partial<Pick<User, 'displayName' | 'bio' | 'phone' | 'sharePhoneAfterAccept' | 'role'>>): Db {
  const next = clone(db);
  const u = getUser(next, userId) ?? fail('User not found');
  if (patch.displayName !== undefined && (!patch.displayName.trim() || patch.displayName.length > 40)) fail('Display name must be 1–40 characters.');
  if (patch.bio && patch.bio.length > 280) fail('Bio must be 280 characters or fewer.');
  Object.assign(u, patch);
  return next;
}

// ---------------------------------------------------------------- trips
export interface PublishInput {
  origin: ZoneId; destination: ZoneId; via: ZoneId[]; departureAt: string; seats: number;
  contributionCents: number; luggageOk: boolean; notes?: string; accessibilityNotes?: string;
  meetingPoint?: string; vehicle?: string;
}

export function publishTrip(db: Db, userId: string, input: PublishInput, now: Date): { db: Db; tripId: string } {
  const u = requireActive(db, userId);
  if (!u.driverDeclaredAt) fail('Please complete the driver declaration before publishing trips.');
  if (input.origin === input.destination) fail('Start and destination must be different.');
  const stops = [input.origin, ...input.via, input.destination];
  if (new Set(stops).size !== stops.length) fail('Each zone can appear only once on a route.');
  const dep = new Date(input.departureAt);
  if (Number.isNaN(dep.getTime())) fail('Please choose a valid date and time.');
  if (dep.getTime() < now.getTime() + 15 * 60000) fail('Departure must be at least 15 minutes from now.');
  if (dep.getTime() > now.getTime() + db.settings.maxDaysAhead * 86400000) fail(`Trips can be published up to ${db.settings.maxDaysAhead} days ahead.`);
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > db.settings.maxSeats) fail(`Seats must be between 1 and ${db.settings.maxSeats}.`);
  if (!Number.isInteger(input.contributionCents) || input.contributionCents < 0) fail('Contribution must be zero or more.');
  if (input.contributionCents > db.settings.maxContributionCents) fail(`The pilot cap is $${db.settings.maxContributionCents / 100} per passenger.`);
  const next = clone(db);
  const id = uid('t');
  next.trips.push({
    id, driverId: userId, stops, departureAt: dep.toISOString(), seatsTotal: input.seats, seatsBooked: 0,
    contributionCents: input.contributionCents, tripType: 'one_way', luggageOk: input.luggageOk,
    notes: input.notes || undefined, accessibilityNotes: input.accessibilityNotes || undefined,
    meetingPoint: input.meetingPoint || undefined, vehicle: input.vehicle || undefined,
    status: 'scheduled', createdAt: nowIso(now),
  });
  return { db: next, tripId: id };
}

export function linkRoundTrip(db: Db, userId: string, outboundId: string, returnId: string): Db {
  const next = clone(db);
  const a = getTrip(next, outboundId); const b = getTrip(next, returnId);
  if (!a || !b || a.driverId !== userId || b.driverId !== userId) fail('Both trips must belong to you.');
  a!.tripType = 'round_trip'; a!.returnTripId = returnId;
  b!.tripType = 'round_trip'; b!.returnTripId = outboundId;
  return next;
}

const isLate = (db: Db, t: Trip, now: Date) =>
  new Date(t.departureAt).getTime() - now.getTime() < db.settings.lateCancelHours * 3600000;

export function cancelTrip(db: Db, userId: string, tripId: string, reason: string, now: Date): Db {
  const next = clone(db);
  const t = getTrip(next, tripId);
  if (!t || t.driverId !== userId) fail('Not your trip.');
  if (t!.status !== 'scheduled') fail('This trip is not scheduled.');
  if (!reason.trim()) fail('Please give passengers a reason.');
  for (const b of next.bookings.filter((x) => x.tripId === tripId && (x.status === 'pending' || x.status === 'accepted'))) {
    b.lateCancellation = b.status === 'accepted' && isLate(next, t!, now);
    b.status = 'cancelled'; b.cancelledAt = nowIso(now); b.cancelledBy = userId; b.cancelReason = reason;
  }
  t!.status = 'cancelled'; t!.seatsBooked = 0; t!.cancelledReason = reason;
  return next;
}

// ---------------------------------------------------------------- bookings
export interface SeatRequest { tripId: string; pickup: ZoneId; dropoff: ZoneId; seats: number; message?: string }

export function requestSeat(db: Db, userId: string, r: SeatRequest, now: Date): { db: Db; bookingId: string } {
  requireActive(db, userId);
  const t = getTrip(db, r.tripId);
  if (!t || !isOpen(t, now)) fail('This trip is no longer open for requests.');
  if (t!.driverId === userId) fail('You cannot book your own trip.');
  if (isBlockedBetween(db, userId, t!.driverId)) fail('This trip is not available.');
  if (!tripMatches(t!, r.pickup, r.dropoff)) fail('Pickup and drop-off must be on this trip\'s route, in order.');
  if (r.seats < 1 || r.seats > 4) fail('You can request 1–4 seats.');
  if (seatsLeft(t!) < r.seats) fail('Sorry, there aren\'t enough seats left on this trip.');
  if (db.bookings.some((b) => b.tripId === r.tripId && b.passengerId === userId && (b.status === 'pending' || b.status === 'accepted'))) {
    fail('You already have an active request for this trip.');
  }
  if (r.message && r.message.length > 300) fail('Message must be 300 characters or fewer.');
  const next = clone(db);
  const id = uid('b');
  next.bookings.push({
    id, tripId: r.tripId, passengerId: userId, seats: r.seats, pickupZoneId: r.pickup, dropoffZoneId: r.dropoff,
    message: r.message || undefined, status: 'pending', createdAt: nowIso(now), lateCancellation: false,
  });
  return { db: next, bookingId: id };
}

export function respondToBooking(db: Db, userId: string, bookingId: string, accept: boolean, now: Date): { db: Db; status: BookingStatus } {
  const next = clone(db);
  const b = getBooking(next, bookingId) ?? fail('Booking not found.');
  const t = getTrip(next, b.tripId)!;
  if (t.driverId !== userId) fail('Only the driver can respond to this request.');
  requireActive(next, userId);
  if (b.status !== 'pending') fail('This request is no longer pending.');
  if (!isOpen(t, now)) fail('This trip is no longer open.');
  if (accept) {
    if (seatsLeft(t) < b.seats) fail('Not enough seats left to accept this request.');
    t.seatsBooked += b.seats;
    b.status = 'accepted';
  } else {
    b.status = 'declined';
  }
  b.respondedAt = nowIso(now);
  return { db: next, status: b.status };
}

export function cancelBooking(db: Db, userId: string, bookingId: string, reason: string, now: Date): Db {
  const next = clone(db);
  const b = getBooking(next, bookingId) ?? fail('Booking not found.');
  const t = getTrip(next, b.tripId)!;
  if (userId !== b.passengerId && userId !== t.driverId) fail('Not your booking.');
  if (b.status !== 'pending' && b.status !== 'accepted') fail('This booking can no longer be cancelled.');
  if (b.status === 'accepted') t.seatsBooked -= b.seats;
  b.lateCancellation = b.status === 'accepted' && isLate(next, t, now);
  b.status = 'cancelled'; b.cancelledAt = nowIso(now); b.cancelledBy = userId; b.cancelReason = reason || undefined;
  return next;
}

/** Equivalent of the scheduled expire_departed() job. */
export function expireDeparted(db: Db, now: Date): Db {
  const next = clone(db);
  for (const b of next.bookings) {
    const t = getTrip(next, b.tripId)!;
    if (b.status === 'pending' && new Date(t.departureAt) <= now) b.status = 'expired';
  }
  for (const t of next.trips) {
    if (t.status === 'scheduled' && new Date(t.departureAt).getTime() < now.getTime() - 6 * 3600000) t.status = 'completed';
  }
  return next;
}

// ---------------------------------------------------------------- messaging & trust
export function isBookingParty(db: Db, b: Booking, userId: string) {
  return b.passengerId === userId || getTrip(db, b.tripId)?.driverId === userId;
}

export function sendMessage(db: Db, userId: string, bookingId: string, body: string, now: Date): Db {
  requireActive(db, userId);
  const b = getBooking(db, bookingId) ?? fail('Booking not found.');
  if (!isBookingParty(db, b, userId)) fail('Not your booking.');
  if (b.status !== 'pending' && b.status !== 'accepted') fail('Messaging is closed for this booking.');
  const t = getTrip(db, b.tripId)!;
  if (isBlockedBetween(db, b.passengerId, t.driverId)) fail('Messaging is not available.');
  const text = body.trim();
  if (!text || text.length > 1000) fail('Message must be 1–1000 characters.');
  const next = clone(db);
  next.messages.push({ id: uid('m'), bookingId, senderId: userId, body: text, createdAt: nowIso(now) });
  return next;
}

export function blockUser(db: Db, userId: string, otherId: string): Db {
  if (userId === otherId) fail('You cannot block yourself.');
  if (db.blocks.some((x) => x.blockerId === userId && x.blockedId === otherId)) return db;
  const next = clone(db);
  next.blocks.push({ blockerId: userId, blockedId: otherId });
  return next;
}

export function unblockUser(db: Db, userId: string, otherId: string): Db {
  const next = clone(db);
  next.blocks = next.blocks.filter((x) => !(x.blockerId === userId && x.blockedId === otherId));
  return next;
}

export interface ReportInput { reportedId?: string; tripId?: string; bookingId?: string; category: ReportCategory; details: string }

export function fileReport(db: Db, userId: string, r: ReportInput, now: Date): Db {
  if (!getUser(db, userId)) fail('Please sign in first.');
  if (r.reportedId === userId) fail('You cannot report yourself.');
  if (!r.details.trim() || r.details.length > 2000) fail('Please describe what happened (up to 2000 characters).');
  const next = clone(db);
  next.reports.push({ id: uid('r'), reporterId: userId, ...r, details: r.details.trim(), status: 'open', createdAt: nowIso(now) });
  return next;
}

// ---------------------------------------------------------------- feedback & demand
export interface FeedbackInput {
  outcome: RideOutcome; settled?: Settlement; rating?: number; feltSafe?: boolean; minutesSaved?: number;
  alternativeMode?: string; alternativeCostCents?: number; wouldUseAgain?: boolean; comments?: string;
}

export function canGiveFeedback(db: Db, b: Booking, userId: string, now: Date): boolean {
  const t = getTrip(db, b.tripId);
  return !!t && isBookingParty(db, b, userId) && (b.status === 'accepted' || b.status === 'completed')
    && new Date(t.departureAt) <= now && !db.feedback.some((f) => f.bookingId === b.id && f.authorId === userId);
}

export function submitFeedback(db: Db, userId: string, bookingId: string, f: FeedbackInput, now: Date): Db {
  const b = getBooking(db, bookingId) ?? fail('Booking not found.');
  const t = getTrip(db, b.tripId)!;
  if (!isBookingParty(db, b, userId)) fail('Not your booking.');
  if (b.status !== 'accepted' && b.status !== 'completed') fail('Only accepted bookings can be reviewed.');
  if (new Date(t.departureAt) > now) fail('Feedback opens after the trip departs.');
  if (db.feedback.some((x) => x.bookingId === bookingId && x.authorId === userId)) fail('You already submitted feedback for this trip.');
  const next = clone(db);
  const entry: Feedback = { id: uid('f'), bookingId, authorId: userId, authorRole: t.driverId === userId ? 'driver' : 'passenger', ...f, createdAt: nowIso(now) };
  next.feedback.push(entry);
  if (f.outcome === 'completed') getBooking(next, bookingId)!.status = 'completed';
  return next;
}

export function addRideRequest(db: Db, userId: string, r: { originZoneId: ZoneId; destinationZoneId: ZoneId; desiredDate: string; earliest?: string; latest?: string; isRecurring: boolean; notes?: string }, now: Date): Db {
  requireActive(db, userId);
  if (r.originZoneId === r.destinationZoneId) fail('Start and destination must be different.');
  if (!r.desiredDate) fail('Please choose a date.');
  const next = clone(db);
  next.rideRequests.push({ id: uid('rr'), userId, ...r, createdAt: nowIso(now) });
  return next;
}

// ---------------------------------------------------------------- admin
const requireAdmin = (db: Db, userId: string) => { if (!getUser(db, userId)?.isAdmin) fail('Admin only.'); };

export function setAccountStatus(db: Db, adminId: string, userId: string, status: 'active' | 'suspended', reason: string, now: Date): Db {
  requireAdmin(db, adminId);
  if (status === 'suspended' && !reason.trim()) fail('A reason is required to suspend an account.');
  const next = clone(db);
  const u = getUser(next, userId) ?? fail('User not found.');
  u.status = status; u.suspendedReason = status === 'suspended' ? reason : undefined;
  next.adminActions.push({ at: nowIso(now), adminId, action: `set_status:${status}`, targetUserId: userId, details: reason });
  return next;
}

export function updateReport(db: Db, adminId: string, reportId: string, status: ReportStatus, notes: string | undefined, now: Date): Db {
  requireAdmin(db, adminId);
  const next = clone(db);
  const r: Report = next.reports.find((x) => x.id === reportId) ?? fail('Report not found.');
  r.status = status; r.adminNotes = notes;
  next.adminActions.push({ at: nowIso(now), adminId, action: `report:${status}`, targetUserId: r.reportedId, details: reportId });
  return next;
}

export function updateSettings(db: Db, adminId: string, s: Partial<Db['settings']>): Db {
  requireAdmin(db, adminId);
  const next = clone(db);
  next.settings = { ...next.settings, ...s };
  return next;
}

export function track(db: Db, name: string, userId?: string, now = new Date()): Db {
  const next = clone(db);
  next.events.push({ name, at: nowIso(now), userId });
  return next;
}

// ---------------------------------------------------------------- metrics
export interface PilotMetrics {
  users: number; drivers: number; passengers: number; activatedUsers: number;
  tripsPublished: number; distinctPublishingDrivers: number; seatsOffered: number;
  seatRequests: number; acceptedEver: number; acceptanceRate: number | null;
  completedRides: number; cancellationsAfterAccept: number; lateCancellations: number;
  cancellationRate: number | null; noShowReports: number; repeatPassengers: number;
  avgContributionCents: number | null; settledShare: number | null; medianMinutesSaved: number | null;
  searches: number; searchesNoResults: number; rideRequests: number; openReports: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function computeMetrics(db: Db): PilotMetrics {
  const drivers = db.users.filter((u) => u.role !== 'passenger' && !u.isAdmin).length;
  const passengers = db.users.filter((u) => u.role !== 'driver' && !u.isAdmin).length;
  const activated = new Set([...db.trips.map((t) => t.driverId), ...db.bookings.map((b) => b.passengerId)]);
  const accepted = db.bookings.filter((b) => b.respondedAt && b.status !== 'declined');
  const answered = db.bookings.filter((b) => b.respondedAt || b.status === 'expired');
  const cancelledAfterAccept = db.bookings.filter((b) => b.status === 'cancelled' && b.respondedAt);
  const completed = db.bookings.filter((b) => b.status === 'completed');
  const perPassenger = new Map<string, number>();
  completed.forEach((b) => perPassenger.set(b.passengerId, (perPassenger.get(b.passengerId) ?? 0) + 1));
  const completedFeedback = db.feedback.filter((f) => f.outcome === 'completed');
  const settledAnswers = completedFeedback.filter((f) => f.settled && f.settled !== 'not_applicable');
  return {
    users: db.users.filter((u) => !u.isAdmin).length, drivers, passengers, activatedUsers: activated.size,
    tripsPublished: db.trips.length, distinctPublishingDrivers: new Set(db.trips.map((t) => t.driverId)).size,
    seatsOffered: db.trips.reduce((s, t) => s + t.seatsTotal, 0),
    seatRequests: db.bookings.length, acceptedEver: accepted.length,
    acceptanceRate: answered.length ? accepted.length / answered.length : null,
    completedRides: completed.length, cancellationsAfterAccept: cancelledAfterAccept.length,
    lateCancellations: db.bookings.filter((b) => b.lateCancellation).length,
    cancellationRate: accepted.length ? cancelledAfterAccept.length / accepted.length : null,
    noShowReports: db.feedback.filter((f) => f.outcome === 'driver_no_show' || f.outcome === 'passenger_no_show').length,
    repeatPassengers: [...perPassenger.values()].filter((n) => n >= 2).length,
    avgContributionCents: accepted.length ? Math.round(accepted.reduce((s, b) => s + (getTrip(db, b.tripId)?.contributionCents ?? 0), 0) / accepted.length) : null,
    settledShare: settledAnswers.length ? settledAnswers.filter((f) => f.settled === 'settled').length / settledAnswers.length : null,
    medianMinutesSaved: median(db.feedback.map((f) => f.minutesSaved).filter((x): x is number => typeof x === 'number')),
    searches: db.events.filter((e) => e.name === 'search_performed').length,
    searchesNoResults: db.events.filter((e) => e.name === 'search_no_results').length,
    rideRequests: db.rideRequests.length,
    openReports: db.reports.filter((r) => r.status === 'open' || r.status === 'reviewing').length,
  };
}

/**
 * Anonymized booking-level export: random row ids (not DB ids), zone names,
 * day + hour bucket only. No names, emails, phones, free text or messages.
 */
export function anonymizedBookingsCsv(db: Db, zoneName: (id: ZoneId) => string): string {
  const header = ['row', 'departure_date', 'departure_hour', 'pickup_zone', 'dropoff_zone', 'seats', 'contribution_cad', 'status', 'late_cancellation', 'passenger_outcome', 'driver_outcome', 'settled', 'minutes_saved'];
  const shuffled = [...db.bookings].sort(() => Math.random() - 0.5);
  const rows = shuffled.map((b, i) => {
    const t = getTrip(db, b.tripId)!;
    const fb = (role: 'driver' | 'passenger') => db.feedback.find((f) => f.bookingId === b.id && f.authorRole === role);
    const p = fb('passenger'); const d = fb('driver');
    return [i + 1, vancouverDate(t.departureAt), vancouverTime(t.departureAt).slice(0, 2), zoneName(b.pickupZoneId), zoneName(b.dropoffZoneId),
      b.seats, (t.contributionCents / 100).toFixed(2), b.status, b.lateCancellation, p?.outcome ?? '', d?.outcome ?? '',
      p?.settled ?? d?.settled ?? '', p?.minutesSaved ?? ''];
  });
  const esc = (v: unknown) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}
