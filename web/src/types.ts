// Domain types for the prototype. They mirror docs/schema/proposed_schema.sql
// so Stage 3 can swap the mock engine for Supabase calls without UI changes.

export type ZoneId = number;
export type RolePref = 'passenger' | 'driver' | 'both';
export type TripStatus = 'scheduled' | 'cancelled' | 'completed';
export type BookingStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'completed';
export type RideOutcome = 'completed' | 'driver_no_show' | 'passenger_no_show' | 'cancelled' | 'other';
export type Settlement = 'settled' | 'not_settled' | 'partially' | 'waived' | 'not_applicable';
export type ReportCategory =
  | 'safety_concern' | 'harassment' | 'no_show' | 'late_cancellation'
  | 'unsafe_driving' | 'commercial_activity' | 'inappropriate_content' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';

export interface Zone {
  id: ZoneId;
  slug: string;
  name: string;
  municipality: 'Surrey' | 'White Rock';
  description: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  displayName: string;   // public: "Priya S."
  fullName: string;      // private
  email: string;         // private
  phone?: string;        // private, optional
  sharePhoneAfterAccept: boolean;
  role: RolePref;
  bio?: string;
  avatarColor: string;   // stands in for an optional photo
  createdAt: string;
  driverDeclaredAt?: string;
  respectPledgeAt?: string;
  status: 'active' | 'suspended';
  suspendedReason?: string;
  isAdmin: boolean;
  acquisitionSource?: string;
}

export interface Trip {
  id: string;
  driverId: string;
  stops: ZoneId[];       // ordered: origin first, destination last
  departureAt: string;   // ISO UTC
  seatsTotal: number;
  seatsBooked: number;
  contributionCents: number;
  tripType: 'one_way' | 'round_trip';
  returnTripId?: string;
  luggageOk: boolean;
  notes?: string;
  accessibilityNotes?: string;
  meetingPoint?: string;   // private until accepted
  vehicle?: string;        // private until accepted
  status: TripStatus;
  cancelledReason?: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  tripId: string;
  passengerId: string;
  seats: number;
  pickupZoneId: ZoneId;
  dropoffZoneId: ZoneId;
  message?: string;
  status: BookingStatus;
  createdAt: string;
  respondedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
  lateCancellation: boolean;
}

export interface Message { id: string; bookingId: string; senderId: string; body: string; createdAt: string }

export interface Report {
  id: string;
  reporterId: string;
  reportedId?: string;
  tripId?: string;
  bookingId?: string;
  category: ReportCategory;
  details: string;
  status: ReportStatus;
  adminNotes?: string;
  createdAt: string;
}

export interface Feedback {
  id: string;
  bookingId: string;
  authorId: string;
  authorRole: 'driver' | 'passenger';
  outcome: RideOutcome;
  settled?: Settlement;
  rating?: number;
  feltSafe?: boolean;
  minutesSaved?: number;
  alternativeMode?: string;
  alternativeCostCents?: number;
  wouldUseAgain?: boolean;
  comments?: string;
  createdAt: string;
}

export interface RideRequest {
  id: string;
  userId: string;
  originZoneId: ZoneId;
  destinationZoneId: ZoneId;
  desiredDate: string;   // YYYY-MM-DD
  earliest?: string;     // HH:MM
  latest?: string;
  isRecurring: boolean;
  notes?: string;
  createdAt: string;
}

export interface AnalyticsEvent { name: string; at: string; userId?: string }

export interface Settings { maxContributionCents: number; lateCancelHours: number; maxDaysAhead: number; maxSeats: number }

export interface Db {
  users: User[];
  trips: Trip[];
  bookings: Booking[];
  messages: Message[];
  reports: Report[];
  feedback: Feedback[];
  rideRequests: RideRequest[];
  blocks: { blockerId: string; blockedId: string }[];
  events: AnalyticsEvent[];
  adminActions: { at: string; adminId: string; action: string; targetUserId?: string; details?: string }[];
  settings: Settings;
}
