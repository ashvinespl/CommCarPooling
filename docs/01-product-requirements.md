# Product Requirements Document — Community Carpooling Pilot (Surrey ↔ White Rock)

| | |
|---|---|
| **Status** | Stage 1 draft for owner review |
| **Working name** | *CommCarPooling* (placeholder; brand TBD) |
| **Pilot area** | Surrey (incl. South Surrey) ↔ White Rock, British Columbia |
| **Pilot length** | 4 weeks of live operation |
| **Budget envelope** | CAD $1,000–$5,000 total initial spend |
| **Last updated** | 2026-10-12 |

---

## 1. Problem and hypothesis

Many cars on Surrey–White Rock routes have empty seats, while some residents find transit slow or indirect for these trips (e.g., Newton or Guildford → White Rock involves transfers) and private ride-hailing expensive.

**We don't yet know whether there's demand.** The pilot tests these hypotheses:

| # | Hypothesis | Pilot signal that would support it | Signal that would reject it |
|---|---|---|---|
| H1 | Drivers will publish trips they are already making | ≥ 30 trips published by ≥ 10 distinct drivers in 4 weeks | < 10 trips, or nearly all from 1–2 drivers |
| H2 | Passengers will find trips that fit and request seats | ≥ 25% of searches with a date return ≥ 1 trip; ≥ 30 seat requests | Most searches return nothing and few "ride requests" cluster on the same route/time |
| H3 | Drivers will accept strangers from their community | ≥ 50% of requests accepted | < 30% accepted, or drivers report discomfort |
| H4 | Accepted rides actually happen | ≥ 70% of accepted bookings self-reported as completed | High cancellation/no-show rate |
| H5 | People come back | ≥ 25% of passengers with a completed ride book again within 30 days | Almost no repeat use |

These thresholds are **decision aids, not forecasts**. They will be revisited with the owner before launch.

## 2. Product vision and positioning

> Share the seats already on the road. Neighbours heading the same way split the cost of a trip the driver was going to make anyway.

* **Is:** a community noticeboard with a structured booking flow for personal, non-commercial carpooling, where passengers offer a contribution toward the driver's trip costs.
* **Is not:** a taxi, ride-hailing or on-demand service. Drivers don't take trips they weren't already making, the platform doesn't dispatch, and nobody earns a living from it.
* **Messaging rules:** no claims of guaranteed savings, guaranteed rides, "verified" users, "safe" drivers, or legal compliance (see `06-legal-safety-privacy.md`).

## 3. Target users and personas

| Persona | Description | Primary need | Key concern |
|---|---|---|---|
| **Commuter driver — "Dana"** | Drives Newton → White Rock for work 4 days/week | Offset fuel and parking costs with little effort | Strangers in the car; hassle; insurance |
| **Student passenger — "Priya"** | KPU/SFU Surrey student living in South Surrey | Cheaper, faster than 2 buses | Safety; reliability; being stranded |
| **Shift worker passenger — "Marco"** | Works at Peace Arch Hospital, irregular hours | Rides when transit is sparse | Getting a ride at odd hours |
| **Occasional driver — "Glen"** | Retiree driving to Surrey Central weekly | Company and some cost-sharing | Scams; tech complexity |
| **Pilot admin — the owner** | Runs the pilot evenings/weekends | See what's happening; act on reports fast | Time; liability |

## 4. Scope

### 4.1 In scope (MVP / pilot)

Priority: **P0** = required to launch the pilot · **P1** = strongly wanted, can ship in week 1–2 of the pilot · **P2** = only if time allows.

#### A. Registration & accounts
| ID | Requirement | Pri |
|---|---|---|
| A1 | Email + password sign-up and login (Supabase Auth) with email confirmation | P0 |
| A2 | Role choice: passenger, driver, or both (changeable later) | P0 |
| A3 | Collect: **display name** (first name + last initial, public), **full name** (private), **email** (private, for login), **phone** (optional, private, used only for an opt-in post-acceptance share), **profile photo** (optional, public to signed-in users) | P0 |
| A4 | Required consents with timestamps and version: Terms of Use, Privacy Notice, Community Safety Rules; 18+ confirmation; **pledge to treat drivers and passengers with respect** | P0 |
| A5 | Driver self-declaration (valid BC licence, valid insurance for the vehicle, personal non-commercial trips, contribution ≤ trip costs). Stored and labelled as *self-declared*, never "verified" | P0 |
| A6 | Password reset; account deletion request (manual admin process in pilot) | P0 / P1 |
| A7 | "How did you hear about us?" (acquisition source) | P1 |

#### B. Publish a trip
| ID | Requirement | Pri |
|---|---|---|
| B1 | Origin and destination chosen from **configured pickup zones** (public places, not addresses) | P0 |
| B2 | Optional intermediate zones in order | P0 |
| B3 | Departure date and time (≥ 15 min ahead, ≤ 30 days ahead) | P0 |
| B4 | Seats offered (1–4, configurable cap) | P0 |
| B5 | Proposed contribution per passenger in CAD, capped by an admin setting; labelled "proposed shared-trip contribution — not a fare" | P0 |
| B6 | One-way or round-trip (round trip = two linked trips, each bookable separately) | P1 |
| B7 | Notes, luggage, accessibility notes | P0 |
| B8 | Exact meeting point + vehicle description, shown only to accepted passengers | P0 |
| B9 | Edit notes, cancel trip (notifies passengers) | P0 |
| B10 | "Duplicate this trip" for regular commuters | P1 |

#### C. Search & match
| ID | Requirement | Pri |
|---|---|---|
| C1 | Search by pickup zone, drop-off zone and date | P0 |
| C2 | Match = trip's ordered zone list contains pickup **before** drop-off (covers "passing reasonably close") | P0 |
| C3 | Filter by time window, max contribution, seats needed | P0 |
| C4 | Results list: time, route, seats left, contribution, driver display name (signed-in only) | P0 |
| C5 | Trip detail: route zones, notes, driver's public profile (display name, photo, member since, completed-trip count) | P0 |
| C6 | Browse without login; login required to see driver identity and request | P0 |
| C7 | Empty state → "Request a ride that isn't listed" (unmet-demand capture) | P0 |
| C8 | Map view of zones | P2 (not needed for matching) |

#### D. Booking
| ID | Requirement | Pri |
|---|---|---|
| D1 | Passenger requests seat(s) with pickup/drop-off zone and optional message | P0 |
| D2 | Driver accepts/declines; seats update atomically on accept | P0 |
| D3 | Prevent overbooking and duplicate live requests (DB-enforced) | P0 |
| D4 | Booking status visible to both parties: pending, accepted, declined, cancelled, expired, completed. The bookings list is sorted by trip date: upcoming soonest first, then past most recent first | P0 |
| D4a | **Drivers may decline a request or end a ride at any time, before or during the trip.** The seat is released and the passenger notified. It isn't counted as a late cancellation, and admins can see it | P0 |
| D5 | Cancellation by either party, with pilot rules shown before confirming (see §6) | P0 |
| D6 | Pending requests auto-expire at departure | P0 |
| D7 | Email notifications: new request, accepted/declined, cancelled, 24-h-before reminder, post-trip survey link | P1 (request/accept/cancel are P0 if feasible) |

#### E. Communication & trust
| ID | Requirement | Pri |
|---|---|---|
| E1 | In-app messages per booking (pending and accepted only) | P0 |
| E2 | Optional phone sharing after acceptance (opt-in per user) | P1 |
| E3 | Report a user / trip / booking (categories incl. safety, harassment, no-show, commercial activity) | P0 |
| E4 | Block a user (hides their trips and profile, prevents requests and messages) | P0 |
| E5 | Trip and booking history | P0 |
| E6 | Safety guidance: share trip details with a friend, meet in public. **"Emergency? Call 911 first"** is shown on the trip request, booking, onboarding, safety rules and footer | P0 |
| E7 | **Insurance notice:** "This platform does not provide or arrange insurance. Vehicle insurance is each driver's own responsibility and choice." Shown with the 911 notice, in the driver declaration, Terms and FAQ | P0 |

#### F. Pilot administration
| ID | Requirement | Pri |
|---|---|---|
| F1 | Lists of users, trips, bookings, reports, feedback, ride requests | P0 |
| F2 | Suspend/reinstate accounts with reason (audited) | P0 |
| F3 | Report triage: open → reviewing → actioned/dismissed, with notes | P0 |
| F4 | Metrics dashboard (see §7) | P1 |
| F5 | CSV export of **anonymized** metrics (no names, emails, phones, free text) | P0 |
| F6 | Edit pickup zones and settings (contribution cap, late-cancel window) | P1 |

#### G. Pilot validation
| ID | Requirement | Pri |
|---|---|---|
| G1 | First-party, privacy-conscious event tracking (no cookies for tracking, no IP storage) | P0 |
| G2 | Post-trip survey: did it happen, contribution settled?, felt safe, time saved, alternative mode & cost, would use again | P0 |
| G3 | Abandonment reasons: short optional prompt when leaving a booking/publish flow | P1 |
| G4 | Unmet-demand "ride request" form | P0 |

### 4.2 Out of scope (pilot) — designed for later
* Payments, payouts, commissions, stored banking/card data.
* Native iOS/Android apps (the web app is mobile-first; PWA install is a P2 option).
* Push notifications, SMS.
* Identity or licence verification, background checks.
* Route optimization, live tracking, ETA, turn-by-turn.
* Public star ratings/reviews (feedback is private to admins during the pilot — sample size is too small for fair public ratings).
* Recurring trip schedules (replaced by "duplicate trip").
* Areas outside Surrey/White Rock.

## 5. Contribution & payment rules (pilot)
1. Drivers propose a per-passenger contribution in CAD, 0 allowed.
2. A **hard cap** (default placeholder CAD $15; to be set after legal/insurance review) prevents amounts that look like for-profit fares. The UI will show a non-binding **cost-recovery guide** (a per-km figure set by the admin after review) next to the input.
3. Everywhere it appears it says: *"Proposed contribution toward trip costs. Not a fare. Settled directly between you, e.g., cash or e-Transfer. The platform does not process payments."*
4. Post-trip survey asks both parties whether the contribution was settled. No banking info is collected.
5. No commission or fees during the pilot.

## 6. Cancellation & no-show rules (pilot, no financial penalties)
* Either party may cancel at any time in-app; the other party is notified.
* **Drivers may decline a request or end a ride at any time, before or during the trip** ("Decline passenger"). This is not flagged as a late cancellation, so drivers are never pressured to continue a ride they're uncomfortable with. Patterns are visible to admins.
* Cancelling an **accepted** booking within **2 hours** of departure (configurable) is recorded as a *late cancellation*.
* No-shows are self-reported in the post-trip survey or via "Report".
* Two or more late cancellations or reported no-shows during the pilot → admin contacts the user; repeated → possible suspension.
* Drivers who cancel a trip must give a reason; all passengers are notified.
* Pending requests that the driver doesn't answer expire at departure time.

## 7. Pilot metrics (definitions)
All metrics computed from DB tables or first-party events, exportable to CSV.

| Metric | Definition |
|---|---|
| Visitor → registration conversion | distinct `anon_id` with `signup_completed` ÷ distinct `anon_id` with `landing_view` |
| Activation | registered users who published ≥ 1 trip or requested ≥ 1 seat ÷ registered users |
| Supply | trips published; distinct drivers publishing; seats offered |
| Search success | `search_performed` with ≥ 1 result ÷ all `search_performed` |
| Request acceptance rate | accepted (incl. later cancelled/completed) ÷ requests that got a response or expired |
| Confirmed bookings | bookings ever accepted |
| Completed rides | bookings with ≥ 1 feedback `outcome = completed` |
| Cancellation rate | cancelled after acceptance ÷ accepted; late cancellation share |
| No-show rate | feedback reporting a driver or passenger no-show ÷ accepted bookings past departure |
| Repeat usage | passengers with ≥ 2 completed rides within 30 days of their first ÷ passengers with ≥ 1 |
| Average contribution | mean `contribution_cents` across accepted bookings |
| Self-reported savings | median `minutes_saved_estimate`; median (`alternative_cost_cents` − contribution) |
| Settlement | share of completed rides reported "settled" |
| Abandonment | `booking_request_started` without `booking_requested` in the same session; reasons from G3 |
| Unmet demand | ride requests by zone pair × time-of-day bucket |

**Pilot targets (experimental, not forecasts):** 20–30 registered drivers, 50–100 registered passengers, ≥ 30 published trips, with all request/booking/completion figures tracked.

## 8. Non-functional requirements
* **Mobile-first:** usable on a 360 px wide screen; WCAG 2.1 AA colour contrast, keyboard access, labelled form fields.
* **Performance:** search response < 1 s at pilot scale; first load < 3 s on 4G.
* **Security:** RLS on every table; writes that change seats only via audited DB functions; service-role key never in the client; HTTPS only; Supabase Auth email confirmation; rate limits on auth (Supabase defaults) and on sign-up and messaging (to review in Stage 6).
* **Privacy:** data minimization; data hosted in Canada (Supabase `ca-central-1` region) if possible; no exact addresses; meeting point hidden until accepted; anonymized exports; retention: delete pilot personal data 12 months after pilot end unless the user continues (to confirm with legal).
* **Reliability:** pilot-grade, best effort. Daily backups require Supabase Pro (see the plan).
* **Modularity:** domain logic in DB functions + a typed client "service" layer, so a native app, payments or push can reuse the same API.

## 9. Key risks
| Risk | Impact | Mitigation |
|---|---|---|
| Legal classification (passenger transportation / TNS licensing) | Could block launch | Legal opinion **before** public launch; contribution cap; non-commercial driver declaration; no dispatch |
| Insurance coverage gaps for drivers | Harm to users; reputational | ICBC/broker confirmation; clear guidance to drivers; declaration |
| Cold start: no trips → no passengers | Pilot fails to learn | Recruit drivers first (community groups, workplaces, campuses); seed with regular commuter routes; capture unmet demand |
| Safety incident | Severe | Public meeting zones; hidden details until acceptance; report/block; incident procedure; 18+ only |
| Discrimination in accept/decline | Harm; human-rights complaints | Community rules; monitoring decline patterns; reports |
| Owner time (evenings/weekends) | Slow responses to reports | Admin email alerts for reports; posted response-time expectations |
| Free-tier limits (auth emails, project pausing) | Broken sign-ups | Custom SMTP; Supabase Pro during the live pilot |
