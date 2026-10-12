# Screen List & UX Notes

Mobile-first (designed at 375 px, works from 360 px up to desktop). Bottom tab bar on mobile: **Find · Offer · Bookings · Profile**. Top nav on desktop.

**Design direction:** calm and trustworthy. White/off-white background, one deep-green primary (community and transport), a warm accent for calls to action, system font stack, large tap targets (≥ 44 px), plain-language labels. Contribution amounts are always shown with the caption "proposed contribution". No stock photos of smiling strangers in cars. Use simple illustrations of the Surrey–White Rock area.

| ID | Screen | Purpose | Key elements | Auth | Pri |
|---|---|---|---|---|---|
| S1 | **Landing** | Explain the concept; route to search/offer | Hero: "Share the seats already on the road." Sub: "Find neighbours heading from Surrey to White Rock and split the trip cost." CTAs *Find a ride* / *Offer a seat*; How it works (3 steps); "How contributions work"; safety commitments (what we do *and don't* do); pilot notice ("A 4-week community pilot. Ride availability isn't guaranteed."); FAQ; footer links | Public | P0 |
| S2 | **Sign up / Log in** | Account access | Email, password, show/hide, reset link, "check spam" hint | Public | P0 |
| S2b | **Onboarding** | Complete profile + consent | Display name (with hint "first name + last initial"), full name (private badge), role, optional phone (private badge, why we ask), 18+ checkbox, 3 consents linking to S11 pages, "How did you hear about us?" | Signed in | P0 |
| S2c | **Driver declaration** | Required before first publish | 4 checkboxes with plain explanations; "This is a self-declaration. We do not verify licences or insurance." | Signed in | P0 |
| S3 | **Find a ride (search)** | Discovery | Pickup zone, drop-off zone (swap button), date (Today / Tomorrow / picker); filters sheet: time window, max contribution, seats | Public | P0 |
| S3b | **Results** | Compare trips | Cards: departure time, route chips (pickup → drop-off highlighted), seats left, contribution, driver display name (signed-in); empty state → S12 | Public | P0 |
| S4 | **Offer a seat (publish)** | Create trip | 4-step form (Route → When & seats → Contribution → Details), review step, "Add return trip" | Driver | P0 |
| S5 | **Trip detail** | Decide to request | Route timeline, time, seats left, contribution + disclaimer, notes, luggage/accessibility, driver card (photo, display name, member since, completed rides); pickup/drop-off selector; *Request seat*; ⋯ Report / Block | Public (request needs sign-in) | P0 |
| S6 | **My trips (driver)** | Manage published trips | Upcoming / Past tabs; per trip: seats booked/total, pending count badge, Edit notes, Duplicate, Cancel trip | Driver | P0 |
| S7 | **Bookings** | Status hub for both roles | Tabs: *My requests* (passenger) / *Requests for my trips* (driver). Status pills. Accept/Decline inline for drivers | Signed in | P0 |
| S7b | **Booking detail + messages** | Coordinate | Status timeline; meeting point + vehicle (after acceptance); message thread; Share trip details (copy text); Cancel (with rules modal); Report | Parties | P0 |
| S8 | **Profile & history** | Self-management | Edit public profile, photo, phone + share toggle, role; trip/booking history; Blocked users; Request account deletion; Log out | Signed in | P0 |
| S9 | **Post-trip survey** | Outcome + validation data | ≤ 8 questions (see J5), skip allowed | Parties | P0 |
| S10 | **Admin dashboard** | Pilot ops | KPI tiles (users by role, trips, requests, acceptance %, completed, cancellations, no-shows, repeat), weekly trend, funnel | Admin | P1 |
| S10b | Admin: Users | Moderate | Search, role, joined, activity counts, status; detail → Suspend/Reinstate | Admin | P0 |
| S10c | Admin: Reports | Triage | Queue by status/age; detail with linked trip/booking; notes; status change | Admin | P0 |
| S10d | Admin: Trips & bookings | Oversight | Filterable tables | Admin | P0 |
| S10e | Admin: Feedback & ride requests | Learn | Survey answers; unmet demand by zone pair/time bucket | Admin | P1 |
| S10f | Admin: Export & settings | Data + config | Anonymized CSV export; zones; contribution cap; late-cancel hours | Admin | P0 (export) / P1 |
| S11 | **Static pages** | Trust & legal | Terms of Use, Privacy Notice, Community Safety Rules, How Contributions Work, Pilot FAQ, Contact | Public | P0 (content must be lawyer-reviewed) |
| S12 | **Request a ride not listed** | Unmet demand | Zones, date, time window, recurring?, notes | Signed in | P0 |

## Cross-cutting UI states
* Loading skeletons; offline/network error with retry; empty states with a next action.
* A suspended-account banner explaining the restriction and how to contact the admin.
* Every destructive action (cancel, block, delete) asks for confirmation.
* Toasts for success; inline errors for validation; server errors map to friendly copy (e.g., "Not enough seats available" → "Sorry, that trip just filled up").

## Copy guardrails
* ✅ "proposed contribution", "share the trip cost", "community pilot", "self-declared"
* ❌ "fare", "earn", "driver income", "verified", "guaranteed", "safe ride", "licensed", "fully insured", "legal"
