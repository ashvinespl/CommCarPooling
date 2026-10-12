import { describe, expect, it } from 'vitest';
import { buildSeed } from './seed';
import * as E from './engine';
import { ZONES } from './zones';
import { addDays, todayVancouver, vancouverDate, vancouverTime, vancouverToIso } from '../lib/time';

const NOW = new Date('2026-10-12T17:00:00Z'); // 10:00 Vancouver (PDT)
const seed = () => buildSeed(NOW);
const tomorrow = addDays(todayVancouver(NOW), 1);
const zoneName = (id: number) => ZONES.find((z) => z.id === id)!.name;

describe('time helpers', () => {
  it('round-trips Vancouver wall-clock time in summer and winter', () => {
    for (const d of ['2026-07-01', '2026-12-15']) {
      const iso = vancouverToIso(d, '07:40');
      expect(vancouverDate(iso)).toBe(d);
      expect(vancouverTime(iso)).toBe('07:40');
    }
  });
});

describe('search', () => {
  it('finds trips passing pickup before drop-off', () => {
    const r = E.searchTrips(seed(), 'u-priya', { pickup: 7, dropoff: 10, date: tomorrow }, NOW);
    expect(r.map((t) => t.id)).toContain('t-dana-am-1');
  });
  it('does not match the reverse direction', () => {
    const r = E.searchTrips(seed(), 'u-priya', { pickup: 10, dropoff: 4, date: tomorrow }, NOW);
    expect(r.map((t) => t.id)).not.toContain('t-dana-am-1');
    expect(r.map((t) => t.id)).toContain('t-dana-pm-1');
  });
  it('applies time, contribution and seat filters', () => {
    const db = seed();
    expect(E.searchTrips(db, undefined, { pickup: 4, dropoff: 10, date: tomorrow, earliest: '08:00' }, NOW)).toHaveLength(0);
    expect(E.searchTrips(db, undefined, { pickup: 4, dropoff: 10, date: tomorrow, maxContributionCents: 500 }, NOW)).toHaveLength(0);
    expect(E.searchTrips(db, undefined, { pickup: 4, dropoff: 10, date: tomorrow, seats: 4 }, NOW)).toHaveLength(0);
  });
  it('hides own trips and trips from blocked drivers', () => {
    let db = seed();
    expect(E.searchTrips(db, 'u-dana', { pickup: 4, dropoff: 10, date: tomorrow }, NOW)).toHaveLength(0);
    db = E.blockUser(db, 'u-priya', 'u-dana');
    expect(E.searchTrips(db, 'u-priya', { pickup: 4, dropoff: 10, date: tomorrow }, NOW)).toHaveLength(0);
  });
});

describe('booking rules', () => {
  it('prevents overbooking, duplicates and own-trip requests', () => {
    let db = seed();
    // Sophie's trip has 1 seat
    const r1 = E.requestSeat(db, 'u-priya', { tripId: 't-sophie-1', pickup: 10, dropoff: 1, seats: 1 }, NOW); db = r1.db;
    const r2 = E.requestSeat(db, 'u-marco', { tripId: 't-sophie-1', pickup: 9, dropoff: 4, seats: 1 }, NOW); db = r2.db;
    expect(() => E.requestSeat(db, 'u-priya', { tripId: 't-sophie-1', pickup: 10, dropoff: 1, seats: 1 }, NOW)).toThrow(/already have an active request/);
    expect(() => E.requestSeat(db, 'u-sophie', { tripId: 't-sophie-1', pickup: 10, dropoff: 1, seats: 1 }, NOW)).toThrow(/own trip/);
    expect(() => E.requestSeat(db, 'u-mei', { tripId: 't-sophie-1', pickup: 1, dropoff: 10, seats: 1 }, NOW)).toThrow(/in order/);
    db = E.respondToBooking(db, 'u-sophie', r1.bookingId, true, NOW).db;
    expect(() => E.respondToBooking(db, 'u-sophie', r2.bookingId, true, NOW)).toThrow(/Not enough seats/);
    expect(() => E.respondToBooking(db, 'u-sophie', r1.bookingId, true, NOW)).toThrow(/no longer pending/);
    expect(E.getTrip(db, 't-sophie-1')!.seatsBooked).toBe(1);
    expect(E.searchTrips(db, 'u-mei', { pickup: 10, dropoff: 1, date: tomorrow }, NOW).map((t) => t.id)).not.toContain('t-sophie-1');
  });

  it('only the driver can respond', () => {
    const db = seed();
    expect(() => E.respondToBooking(db, 'u-marco', 'b-2', true, NOW)).toThrow(/Only the driver/);
  });

  it('cancellation releases seats and flags late cancellations', () => {
    let db = seed();
    db = E.respondToBooking(db, 'u-dana', 'b-2', true, NOW).db;
    expect(E.getTrip(db, 't-dana-am-1')!.seatsBooked).toBe(1);
    db = E.cancelBooking(db, 'u-marco', 'b-2', 'Plans changed', NOW);
    expect(E.getTrip(db, 't-dana-am-1')!.seatsBooked).toBe(0);
    expect(E.getBooking(db, 'b-2')!.lateCancellation).toBe(false);

    const lateNow = new Date(new Date(E.getTrip(db, 't-glen-1')!.departureAt).getTime() - 30 * 60000);
    db = E.cancelBooking(db, 'u-priya', 'b-3', '', lateNow);
    expect(E.getBooking(db, 'b-3')!.lateCancellation).toBe(true);
  });

  it('driver trip cancellation cancels all live bookings', () => {
    let db = seed();
    db = E.cancelTrip(db, 'u-glen', 't-glen-1', 'Car in the shop', NOW);
    expect(E.getBooking(db, 'b-3')!.status).toBe('cancelled');
    expect(E.getTrip(db, 't-glen-1')!.seatsBooked).toBe(0);
    expect(() => E.cancelTrip(db, 'u-glen', 't-glen-2', '', NOW)).toThrow(/reason/);
  });

  it('suspended users cannot request seats', () => {
    let db = seed();
    db = E.setAccountStatus(db, 'u-admin', 'u-marco', 'suspended', 'Test', NOW);
    expect(() => E.requestSeat(db, 'u-marco', { tripId: 't-harj-1', pickup: 3, dropoff: 8, seats: 1 }, NOW)).toThrow(/suspended/);
    expect(() => E.setAccountStatus(db, 'u-priya', 'u-marco', 'active', '', NOW)).toThrow(/Admin only/);
  });

  it('expires pending requests after departure', () => {
    const later = new Date(new Date(E.getTrip(seed(), 't-dana-am-1')!.departureAt).getTime() + 60000);
    const db = E.expireDeparted(seed(), later);
    expect(E.getBooking(db, 'b-2')!.status).toBe('expired');
  });
});

describe('privacy', () => {
  it('reveals meeting point only to driver, accepted passengers and admins', () => {
    const db = seed();
    const t = E.getTrip(db, 't-glen-1')!;
    expect(E.canSeePrivateDetails(db, t, 'u-glen')).toBe(true);
    expect(E.canSeePrivateDetails(db, t, 'u-priya')).toBe(true);   // accepted
    expect(E.canSeePrivateDetails(db, t, 'u-marco')).toBe(false);
    expect(E.canSeePrivateDetails(db, t, undefined)).toBe(false);
    expect(E.canSeePrivateDetails(db, t, 'u-admin')).toBe(true);
  });

  it('anonymized CSV contains no names, emails, ids or free text', () => {
    const csv = E.anonymizedBookingsCsv(seed(), zoneName);
    for (const s of ['Priya', 'Marco', 'example.test', 'u-priya', 'b-2', 'Johnston Rd. Thanks']) expect(csv).not.toContain(s);
    expect(csv.split('\n')[0]).toMatch(/^row,departure_date/);
  });
});

describe('publishing', () => {
  const base = { origin: 4, destination: 10, via: [7], departureAt: vancouverToIso(tomorrow, '09:00'), seats: 2, contributionCents: 600, luggageOk: false };
  it('enforces driver declaration, cap, timing and route rules', () => {
    const db = seed();
    expect(() => E.publishTrip(db, 'u-priya', base, NOW)).toThrow(/driver declaration/);
    expect(() => E.publishTrip(db, 'u-dana', { ...base, contributionCents: 1600 }, NOW)).toThrow(/cap/);
    expect(() => E.publishTrip(db, 'u-dana', { ...base, departureAt: new Date(NOW.getTime() + 5 * 60000).toISOString() }, NOW)).toThrow(/15 minutes/);
    expect(() => E.publishTrip(db, 'u-dana', { ...base, via: [4] }, NOW)).toThrow(/only once/);
    expect(() => E.publishTrip(db, 'u-dana', { ...base, seats: 5 }, NOW)).toThrow(/Seats/);
    const r = E.publishTrip(db, 'u-dana', base, NOW);
    expect(E.getTrip(r.db, r.tripId)!.stops).toEqual([4, 7, 10]);
  });
});

describe('feedback & metrics', () => {
  it('feedback only after departure, once, and marks completion', () => {
    let db = seed();
    expect(() => E.submitFeedback(db, 'u-priya', 'b-3', { outcome: 'completed' }, NOW)).toThrow(/after the trip departs/);
    db = E.submitFeedback(db, 'u-priya', 'b-1', { outcome: 'completed', settled: 'settled', minutesSaved: 25 }, NOW);
    expect(E.getBooking(db, 'b-1')!.status).toBe('completed');
    expect(() => E.submitFeedback(db, 'u-priya', 'b-1', { outcome: 'completed' }, NOW)).toThrow(/already/);
    const m = E.computeMetrics(db);
    expect(m.completedRides).toBe(1);
    expect(m.settledShare).toBe(1);
    expect(m.medianMinutesSaved).toBe(25);
  });

  it('registration enforces age, consent and driver declaration', () => {
    const db = seed();
    const base = { email: 'new@example.test', displayName: 'New U.', fullName: 'New User', role: 'passenger' as const, ageConfirmed: true, consents: true, driverDeclaration: false };
    expect(() => E.registerUser(db, { ...base, ageConfirmed: false }, NOW)).toThrow(/18/);
    expect(() => E.registerUser(db, { ...base, consents: false }, NOW)).toThrow(/Terms/);
    expect(() => E.registerUser(db, { ...base, role: 'driver' }, NOW)).toThrow(/driver declaration/);
    expect(() => E.registerUser(db, { ...base, email: 'u-dana@example.test' }, NOW)).toThrow(/already exists/);
    expect(E.registerUser(db, base, NOW).db.users).toHaveLength(db.users.length + 1);
  });
});
