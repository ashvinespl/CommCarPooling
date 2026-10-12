# Data Model & Access Control

The full proposed DDL, RLS policies and DB functions are in [`schema/proposed_schema.sql`](schema/proposed_schema.sql). It is **tested** (see [Testing](#testing)), but it is a *proposal*. In Stage 3 it becomes the first Supabase migration.

## Entity overview

```
auth.users (Supabase)
    │ 1:1
    ▼
profiles ──1:1── profile_private        admins (subset of profiles)
    │                                    blocks (profile ↔ profile)
    │ 1:N (driver)
    ▼
trips ──1:N── trip_stops ──N:1── pickup_zones
  │   └─1:1── trip_private_details
  │ 1:N
  ▼
bookings ──1:N── booking_messages
  │      └─1:N── trip_feedback (≤1 per participant)
  │
reports (→ profile / trip / booking)     ride_requests (unmet demand)
analytics_events (anon_id, optional user)  admin_actions (audit)   app_settings
```

## Tables

| Table | Purpose | Sensitive? | Who can read | Who can write |
|---|---|---|---|---|
| `pickup_zones` | Admin-configured public meeting areas with approximate coordinates | No | Everyone | Admin |
| `app_settings` | Contribution cap, late-cancel window, etc. | No | Everyone | Admin |
| `profiles` | Display name, role, bio, photo path | Low | Signed-in users (except where blocked) | Owner (limited columns) |
| `profile_private` | Full name, phone, consents, driver declaration, account status | **Yes** | Owner, admin | Owner: phone and phone-share flag only; status changes via admin RPC |
| `admins` | Admin membership | Yes | Admin | DB owner only (SQL) |
| `blocks` | Who blocked whom | Yes | The blocker | The blocker |
| `trips` | Route endpoints, time, seats, contribution, notes, status | Low | Everyone for upcoming scheduled trips; driver, participants, admin always | Via `publish_trip`, `cancel_trip`; driver may edit notes/luggage/accessibility |
| `trip_stops` | Ordered zones incl. origin (seq 0) and destination | No | Same as the trip | Via `publish_trip` |
| `trip_private_details` | Exact meeting point, vehicle description | **Yes** | Driver + **accepted** passengers + admin | Driver |
| `bookings` | Seat requests and their lifecycle | Medium | Passenger, trip driver, admin | Only via RPCs |
| `booking_messages` | Booking-scoped chat | **Yes** | Booking parties, admin | Parties while the booking is pending/accepted and not blocked |
| `reports` | Safety, conduct and no-show reports | **Yes** | Reporter (own), admin | Reporter (insert); admin (triage) |
| `trip_feedback` | Post-trip survey, settlement self-report | Medium | Author, admin | Via `submit_trip_feedback` |
| `ride_requests` | Unmet demand | Low | Owner, admin | Owner |
| `analytics_events` | Whitelisted product events | Low | Admin | Anyone (insert only) |
| `admin_actions` | Audit log | Medium | Admin | Admin RPCs |

## Key design decisions

1. **Zones instead of addresses.** Matching uses an ordered list of admin-defined zones (`trip_stops`). A trip matches if it contains the passenger's pickup zone **before** their drop-off zone. This needs no geocoding, routing or maps API, costs $0, and avoids storing home addresses. If the pilot works, PostGIS distance-to-route matching can replace it later without changing the booking model.
2. **Public / private split by table, not column.** Phone numbers, consents, account status and exact meeting points live in separate tables with stricter RLS, so a careless `select *` can't leak them.
3. **Writes through DB functions.** `publish_trip`, `request_seat`, `respond_to_booking`, `cancel_booking`, `cancel_trip`, `submit_trip_feedback` and `admin_set_account_status` are `SECURITY DEFINER` functions with explicit authorization checks. Clients have no direct `INSERT/UPDATE` on `trips` (except notes) or `bookings`. This keeps all business rules in one place and means a future native app automatically gets the same rules.
4. **Overbooking prevention, three layers:**
   * `respond_to_booking` takes `SELECT … FOR UPDATE` on the trip row, so accepts on the same trip are serialized;
   * `CHECK (seats_booked BETWEEN 0 AND seats_total)` on `trips` as a final guard;
   * a partial unique index `bookings_one_live_per_trip (trip_id, passenger_id) WHERE status IN ('pending','accepted')` prevents duplicate live requests.
5. **Self-declaration, not verification.** `driver_declared_at` records that the driver *declared* licence and insurance. The UI must never call this "verified".
6. **No payment data.** `contribution_cents` is a proposal. Settlement is a self-reported enum in `trip_feedback`.
7. **Feedback is private.** No public ratings in the pilot. Admins use feedback to spot problems.
8. **Analytics without tracking cookies.** A random `anon_id` UUID kept in `localStorage`, event names whitelisted by a CHECK constraint, no IP or user-agent stored, `props` size-limited.
9. **Times** are stored as `timestamptz`. Search converts to `America/Vancouver` for the date and time filters.
10. **Round trips** are two linked `trips` rows (`return_trip_id`), so each leg has its own seats and bookings.

## Supporting jobs (Stage 4)
* `expire_departed()` every 15 min via `pg_cron` (available on Supabase): pending → expired at departure; trips → completed 6 h after departure.
* Email notifications via a Supabase Database Webhook → Edge Function → transactional email provider.

## Anonymized export (Stage 5)
CSV exports will include only: random per-export IDs (not DB UUIDs), zone names, dates (day granularity), hour-of-day bucket, seats, contribution, status, outcomes, survey numeric/enum answers. Exports exclude names, emails, phones, free-text fields, exact timestamps and messages.

## Testing
`schema/tests/run_tests.sh` starts a throwaway PostgreSQL 16, loads a minimal stub of Supabase's `auth` schema and roles, loads the proposed schema and runs:

* **58 sequential checks:** registration rules, publish validation, anonymous vs signed-in search, direction-aware matching, filters, privacy (private profile, meeting-point visibility, column-level update restrictions), booking rules (own trip, duplicates, seat limits, route order), accept/decline, cancellation and seat release, late-cancel flags, messaging RLS, blocking, reports visibility, admin suspension, feedback timing, uniqueness and privacy.
* **1 concurrency test:** two separate DB sessions accept the last seat at the same moment; it asserts exactly one succeeds and `seats_booked = 1`.

Last run (2026-10-12, PostgreSQL 16, this container): **all passed**. Caveat: the stub is not real Supabase. In Stage 3 the same tests should be re-run against the Supabase local stack (`supabase start` + `supabase test db`, pgTAP).
