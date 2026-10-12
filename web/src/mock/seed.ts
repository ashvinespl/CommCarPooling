import type { Booking, Db, Trip, User } from '../types';
import { addDays, todayVancouver, vancouverToIso } from '../lib/time';

/**
 * Realistic sample data for the clickable prototype. Times are generated
 * relative to "now" so the demo always has upcoming trips. All people are
 * fictional.
 */
export function buildSeed(now = new Date()): Db {
  const today = todayVancouver(now);
  const at = (dayOffset: number, time: string) => vancouverToIso(addDays(today, dayOffset), time);
  const created = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();

  const user = (u: Partial<User> & Pick<User, 'id' | 'displayName' | 'fullName' | 'role' | 'avatarColor'>): User => ({
    email: `${u.id}@example.test`, sharePhoneAfterAccept: false, createdAt: created(20),
    status: 'active', isAdmin: false, ...u,
  });

  const users: User[] = [
    user({ id: 'u-dana', displayName: 'Dana K.', fullName: 'Dana Kaur', role: 'driver', avatarColor: '#2b8a62',
      bio: 'Commute Newton → White Rock for work, Mon–Thu. Quiet car, podcasts welcome.', driverDeclaredAt: created(18), createdAt: created(18), acquisitionSource: 'Community Facebook group' }),
    user({ id: 'u-glen', displayName: 'Glen R.', fullName: 'Glen Robertson', role: 'driver', avatarColor: '#3b6fb6',
      bio: 'Retired, head up to Surrey Central most Wednesdays and Saturdays.', driverDeclaredAt: created(15), createdAt: created(15), acquisitionSource: 'Library poster' }),
    user({ id: 'u-mei', displayName: 'Mei L.', fullName: 'Mei Lin', role: 'both', avatarColor: '#9a4fb0',
      bio: 'Nurse at Peace Arch Hospital. Sometimes drive, sometimes ride.', driverDeclaredAt: created(12), createdAt: created(12) }),
    user({ id: 'u-harj', displayName: 'Harj S.', fullName: 'Harjit Sandhu', role: 'driver', avatarColor: '#c4721a',
      bio: 'Drive Guildford → South Surrey for work.', driverDeclaredAt: created(10), createdAt: created(10), acquisitionSource: 'Workplace newsletter' }),
    user({ id: 'u-sophie', displayName: 'Sophie B.', fullName: 'Sophie Bouchard', role: 'driver', avatarColor: '#b63b5c',
      bio: 'White Rock local, weekly trips to KPU Surrey.', driverDeclaredAt: created(9), createdAt: created(9) }),
    user({ id: 'u-priya', displayName: 'Priya S.', fullName: 'Priya Sharma', role: 'passenger', avatarColor: '#1f6f50',
      bio: 'SFU Surrey student living in South Surrey.', createdAt: created(8), phone: '+1 604 555 0142', acquisitionSource: 'Campus poster' }),
    user({ id: 'u-marco', displayName: 'Marco T.', fullName: 'Marco Tan', role: 'passenger', avatarColor: '#5b6670',
      createdAt: created(6), acquisitionSource: 'Friend' }),
    user({ id: 'u-admin', displayName: 'Pilot Admin', fullName: 'Pilot Administrator', role: 'passenger', avatarColor: '#162028',
      isAdmin: true, createdAt: created(30) }),
  ];

  const trip = (t: Partial<Trip> & Pick<Trip, 'id' | 'driverId' | 'stops' | 'departureAt' | 'seatsTotal' | 'contributionCents'>): Trip => ({
    seatsBooked: 0, tripType: 'one_way', luggageOk: false, status: 'scheduled', createdAt: created(3), ...t,
  });

  const trips: Trip[] = [];
  // Dana: Newton -> South Surrey P&R -> White Rock Centre, weekday mornings next 5 days
  for (let d = 1; d <= 5; d++) {
    trips.push(trip({ id: `t-dana-am-${d}`, driverId: 'u-dana', stops: [4, 7, 10], departureAt: at(d, '07:40'), seatsTotal: 3, contributionCents: 600,
      notes: 'Leaving on time — please be at the meeting point 5 min early.', meetingPoint: 'Newton Exchange, by the bike racks on the 72 Ave side', vehicle: 'Silver Toyota Corolla',
      tripType: 'round_trip', returnTripId: `t-dana-pm-${d}` }));
    trips.push(trip({ id: `t-dana-pm-${d}`, driverId: 'u-dana', stops: [10, 7, 4], departureAt: at(d, '17:15'), seatsTotal: 3, contributionCents: 600,
      meetingPoint: 'White Rock Town Centre, outside the library on Russell Ave', vehicle: 'Silver Toyota Corolla', tripType: 'round_trip', returnTripId: `t-dana-am-${d}` }));
  }
  trips.push(
    trip({ id: 't-glen-1', driverId: 'u-glen', stops: [11, 10, 9, 2, 1], departureAt: at(2, '09:30'), seatsTotal: 2, contributionCents: 700,
      luggageOk: true, notes: 'Happy to help with shopping bags.', accessibilityNotes: 'Sedan, front seat can slide back for extra legroom.', meetingPoint: 'Marine Drive, by the pier entrance', vehicle: 'Blue Honda Accord' }),
    trip({ id: 't-glen-2', driverId: 'u-glen', stops: [1, 2, 9, 10, 11], departureAt: at(2, '14:00'), seatsTotal: 2, contributionCents: 700, luggageOk: true,
      meetingPoint: 'Surrey Central, Central City plaza side', vehicle: 'Blue Honda Accord' }),
    trip({ id: 't-mei-1', driverId: 'u-mei', stops: [3, 5, 8, 10], departureAt: at(3, '06:15'), seatsTotal: 2, contributionCents: 800,
      notes: 'Early shift — I can\'t wait past 6:20.', meetingPoint: 'Guildford Town Centre, north parking lot by the transit exchange', vehicle: 'White Mazda 3' }),
    trip({ id: 't-harj-1', driverId: 'u-harj', stops: [3, 5, 6, 8], departureAt: at(1, '08:10'), seatsTotal: 3, contributionCents: 700,
      meetingPoint: 'Guildford Recreation Centre lot', vehicle: 'Grey Hyundai Tucson' }),
    trip({ id: 't-harj-2', driverId: 'u-harj', stops: [3, 5, 6, 8], departureAt: at(4, '08:10'), seatsTotal: 3, contributionCents: 700,
      meetingPoint: 'Guildford Recreation Centre lot', vehicle: 'Grey Hyundai Tucson' }),
    trip({ id: 't-sophie-1', driverId: 'u-sophie', stops: [10, 9, 4, 1], departureAt: at(1, '12:30'), seatsTotal: 1, contributionCents: 500,
      notes: 'Small car — one backpack per person please.', meetingPoint: 'Semiahmoo Library entrance', vehicle: 'Red Kia Rio' }),
    trip({ id: 't-sophie-2', driverId: 'u-sophie', stops: [10, 9, 4, 1], departureAt: at(6, '12:30'), seatsTotal: 1, contributionCents: 500,
      meetingPoint: 'Semiahmoo Library entrance', vehicle: 'Red Kia Rio' }),
    // Past trip (yesterday) so the post-trip survey can be demoed.
    trip({ id: 't-dana-past', driverId: 'u-dana', stops: [4, 7, 10], departureAt: at(-1, '07:40'), seatsTotal: 3, contributionCents: 600,
      meetingPoint: 'Newton Exchange, by the bike racks', vehicle: 'Silver Toyota Corolla', seatsBooked: 1, createdAt: created(5) }),
  );

  const booking = (b: Partial<Booking> & Pick<Booking, 'id' | 'tripId' | 'passengerId' | 'pickupZoneId' | 'dropoffZoneId'>): Booking => ({
    seats: 1, status: 'pending', createdAt: created(1), lateCancellation: false, ...b,
  });
  const bookings: Booking[] = [
    booking({ id: 'b-1', tripId: 't-dana-past', passengerId: 'u-priya', pickupZoneId: 7, dropoffZoneId: 10, status: 'accepted', createdAt: created(3), respondedAt: created(3) }),
    booking({ id: 'b-2', tripId: 't-dana-am-1', passengerId: 'u-marco', pickupZoneId: 4, dropoffZoneId: 10, message: 'Hi! I work near Johnston Rd. Thanks!' }),
    booking({ id: 'b-3', tripId: 't-glen-1', passengerId: 'u-priya', pickupZoneId: 9, dropoffZoneId: 1, status: 'accepted', respondedAt: created(0.5) }),
  ];
  trips.find((t) => t.id === 't-glen-1')!.seatsBooked = 1;

  return {
    users, trips, bookings,
    messages: [
      { id: 'm-1', bookingId: 'b-3', senderId: 'u-priya', body: 'Thanks Glen! I\'ll be at the library entrance.', createdAt: created(0.4) },
      { id: 'm-2', bookingId: 'b-3', senderId: 'u-glen', body: 'Great — blue Accord, see you at 9:40.', createdAt: created(0.3) },
    ],
    reports: [
      { id: 'r-1', reporterId: 'u-marco', reportedId: 'u-sophie', category: 'late_cancellation', details: 'Sample report: trip cancelled 30 minutes before departure.', status: 'open', createdAt: created(2) },
    ],
    feedback: [],
    rideRequests: [
      { id: 'rr-1', userId: 'u-marco', originZoneId: 11, destinationZoneId: 3, desiredDate: addDays(today, 2), earliest: '17:00', latest: '19:00', isRecurring: true, notes: 'Weekday evenings', createdAt: created(1) },
    ],
    blocks: [],
    events: [],
    adminActions: [],
    settings: { maxContributionCents: 1500, lateCancelHours: 2, maxDaysAhead: 30, maxSeats: 4 },
  };
}
