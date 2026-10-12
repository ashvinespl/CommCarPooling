# Key User Journeys

Each journey lists the happy path, then the edge cases the build must handle. Screen IDs refer to `04-screen-list.md`.

---

## J1. Visitor → registered passenger

1. Visitor lands on **S1 Landing** from a flyer QR code or community post (`landing_view`, with optional `?src=` campaign tag).
2. Taps **"Find a ride"** → **S3 Search**, picks *Newton → White Rock Centre, Thu*, and sees results (driver names hidden).
3. Taps a trip → **S5 Trip detail** → **"Request a seat"** → prompted to sign up.
4. **S2 Sign-up:** email, password → confirmation email → link returns them to the app.
5. **S2b Onboarding:** display name, full name (private), role = passenger, optional phone, 18+ box, three consents (each a linked page). `signup_completed`.
6. Returned to the trip they were viewing, with the request form pre-filled.

**Edge cases:** confirmation email lands in spam (show "check spam" + resend); user abandons onboarding (resume on next login: no `profiles` row means onboarding is required); visitor under 18 (blocked with explanation).

## J2. Driver publishes a trip they were already making

1. Signed-in user with role driver/both → **S4 Publish**. A first-time driver sees the **driver declaration** first (licence, insurance, personal trips, contribution ≤ costs).
2. Step 1 *Route:* origin zone, destination zone, optional stops (ordered chips).
3. Step 2 *When & seats:* date, time, seats (1–4).
4. Step 3 *Contribution:* CAD amount, with the cost-recovery guide and "not a fare" label; the cap is enforced.
5. Step 4 *Details:* notes, luggage, accessibility, **exact meeting point** and **vehicle description** (marked "only shown to passengers you accept").
6. Review → Publish (`trip_published`) → **S6 My trips** with a share link.
7. Optional: "Add return trip" pre-fills the reverse route → linked round trip.

**Edge cases:** departure in the past or < 15 min away; contribution over the cap; same origin and destination; network failure on submit (idempotent retry, no double publish: disable button + server returns the existing id on a repeated client token, Stage 3).

## J3. Passenger requests a seat → driver accepts

```
Passenger                       System                          Driver
   | request_seat() ------------> booking: pending                 |
   |                              email + in-app badge ----------> |
   |                                                  respond_to_booking(accept)
   |                              lock trip row, check seats,       |
   |                              seats_booked += n, accepted       |
   | <---------- email "accepted" + meeting point + vehicle shown   |
   | <================ in-app messages (booking-scoped) ==========> |
```

1. On **S5 Trip detail**, the passenger selects pickup/drop-off zones (limited to this trip's route, in order), seats, optional message → **Request**.
2. **S7 Bookings** shows *Pending*; the driver gets a notification.
3. Driver opens **S7 Bookings → Requests** and sees the passenger's display name, photo, member-since date, completed-ride count, pickup/drop-off and message → **Accept** or **Decline**.
4. On accept, the passenger sees *Accepted*, the exact meeting point, the vehicle description and the message thread. If both opted in, phone numbers are shown.
5. 24 h before (P1), both get a reminder with a "share trip details" link and safety tips.

**Edge cases:**
* Two drivers' devices / double taps → the second accept returns *no longer pending*.
* Last seat accepted concurrently for two passengers → exactly one succeeds (tested; see `schema/tests`).
* Trip full → no longer in search; the request button is disabled with "Full".
* Passenger requests their own trip → blocked.
* Either party has blocked the other → the trip isn't shown and requests are rejected.
* Driver never responds → expires at departure; the passenger is nudged to the unmet-demand form.

## J4. Cancellation

1. From **S7 Booking detail**, **Cancel** → modal shows pilot rules: *"Cancelling less than 2 hours before departure is recorded as a late cancellation. Repeated late cancellations may lead to account review."* → optional reason → confirm.
2. If the booking was accepted, the seat is released immediately and the other party is notified.
3. A driver cancelling a whole trip (**S6 → Cancel trip**) must give a reason; all pending/accepted passengers are notified.

## J5. After the trip — feedback & settlement

1. Departure + 2 h: an email and in-app banner say "How did your trip go?" → **S9 Post-trip survey** (≤ 60 s):
   * Did the ride happen? *(completed / driver no-show / passenger no-show / cancelled / other)*
   * Contribution settled directly? *(settled / not / partially / waived / n/a)*
   * Felt safe? · Overall 1–5 (private) · Minutes saved vs usual · What would you have used instead, and its cost · Would you use again? · Comments
2. Any "completed" report marks the booking *completed* (`feedback_submitted`).
3. A no-show or "felt unsafe" answer prompts an optional **Report**.

## J6. Report or block

1. On a profile, trip or booking, **⋯ → Report** → category + details → submitted; the reporter sees "We review reports within 24 h (pilot hours). If you are in danger call 911."
2. **⋯ → Block** → confirm → the blocked user's trips and profile disappear for the blocker, and requests and messages between them are refused. Unblock from **S8 Profile → Blocked users**.
3. The admin is emailed for every new report (Stage 5) → **S10c Reports**.

## J7. No trip found → unmet demand

Search with zero results (`search_no_results`) → **"Tell us the ride you need"** → zones, date, time window, "regular trip?" → saved. The admin reviews clusters weekly and recruits drivers for popular route/time pairs. (Automatic matching notifications: post-pilot.)

## J8. Admin operations

* **Daily (10 min):** check open reports, newly published trips (spot commercial-looking listings), flagged late cancellations.
* **Suspend:** user detail → Suspend + reason → the user can no longer publish, request or message (enforced in DB functions and RLS). The action is logged in `admin_actions`.
* **Weekly:** metrics dashboard review; CSV export; unmet-demand review; recruitment adjustments.

## Booking state machine

```
              request_seat
                   │
                   ▼
   ┌──────────── pending ─────────────┐
   │ decline       │ accept           │ cancel (either) / departure passes
   ▼               ▼                  ▼
declined        accepted ───────► cancelled          expired (pending at departure)
                   │ feedback "completed"
                   ▼
               completed
```
Seat accounting changes only on `pending→accepted` (+seats) and `accepted→cancelled` (−seats), inside a transaction holding the trip row lock.
