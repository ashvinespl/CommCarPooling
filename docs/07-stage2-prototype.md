# Stage 2 — Clickable Prototype

A mobile-first React + TypeScript app in [`web/`](../web) that covers every P0 screen from [`04-screen-list.md`](04-screen-list.md), using **realistic sample data** for Surrey and White Rock. There is **no backend**: all data lives in the browser (`localStorage`) and nothing is sent anywhere. Screenshots (390 px phone) are in [`prototype-screenshots/`](prototype-screenshots).

## What you can click through

| Journey | How to try it |
|---|---|
| J1 Visitor → search → sign up | Signed out: **Find a ride** → Newton → White Rock Town Centre. Driver names are hidden. **Sign in to request** → *Create an account* → onboarding with consents and 18+ |
| J2 Driver publishes | *Demo as* **Mei L.** → **Offer** → 5-step form (route + stops, time/seats, optional return trip, contribution with $15 cap, private meeting point) |
| J3 Request → accept | *Demo as* **Marco T.** → request a seat on Harj's Guildford trip → switch to **Harj S.** → Bookings → *Requests for my trips* → Accept → switch back to Marco: the meeting point and vehicle are now visible; message the driver |
| J4 Cancellation | Any accepted booking → **Cancel** shows the pilot rules and flags late cancellations (< 2 h) |
| J5 Post-trip survey | *Demo as* **Priya S.** → Bookings → *How did your trip go?* (yesterday's ride with Dana) |
| J6 Report / block | Trip or booking → ⚑ Report / ⦸ Block. Unblock from Profile |
| J7 Unmet demand | A search with no results → *Tell us the ride you need* |
| J8 Admin | *Demo as* **Pilot Admin** → KPIs vs pilot targets, users (suspend/reinstate), report triage, trips/bookings, feedback and unmet demand, anonymized CSV export, settings |

The **Demo as** selector in the header stands in for real login. **Reset demo** in the top banner restores the sample data. Sample trips are generated relative to today, so there are always upcoming trips.

## Architecture (built to be swapped in Stage 3)
* `src/types.ts`: domain types mirroring the SQL schema.
* `src/mock/engine.ts`: a pure-function "backend" enforcing the **same rules as the DB functions** (route-order matching, seat limits, duplicates, late cancellation, suspension, privacy of meeting points, feedback timing). In Stage 3, each function is replaced by a `supabase.rpc(...)` call with the same signature, so the screens don't change.
* `src/state/AppState.tsx`: app state, error → friendly-toast handling, the stand-in for the expiry job.
* `src/lib/time.ts`: all dates are shown in **America/Vancouver** time, whatever the device timezone.
* No maps API: zones link out to a free Google Maps search URL.

## Run it locally
```bash
cd web
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests for the booking rules (Vitest)
npm run build        # typecheck + production build into web/dist
npm run e2e          # Playwright smoke tests at 360 px phone + desktop (needs Chromium;
                     #   set PW_CHROMIUM_PATH to use an installed one)
```

## Single-file preview
`node scripts/build-preview.mjs out.html` (run in `web/`) builds the whole prototype as one self-contained HTML file with in-page routing. That's useful for a private shareable link without setting up hosting.

## Deploy a preview (Cloudflare Pages, free)
1. Push the repo to GitHub.
2. Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* → *Connect to Git* → select the repo.
3. Build settings: **Root directory** `web`, **Build command** `npm run build`, **Output directory** `dist`. No environment variables are needed for the prototype.
4. Every push gets a preview URL. `web/public/_redirects` makes deep links (e.g. `/trips/...`) work.

Cost: $0. No custom domain is needed for the prototype.

## Test results (run 2026-10-12 in this environment)
* **Unit (Vitest):** 20/20 passed (re-run 2026-10-14). They cover bookings sorted by date, drivers declining before or during a ride, the respect pledge, search matching and filters, overbooking, duplicate and own-trip requests, driver-only responses, seat release on cancel, late-cancel flag, trip cancellation, suspension, expiry, meeting-point privacy, the CSV having no PII, publish validation, feedback rules and registration rules.
* **End-to-end (Playwright, Chromium):** 20/20 passed: 10 flows × 2 viewports (360 × 780 phone, desktop). They include checks that no page scrolls horizontally on key pages.
* Not tested yet: real iOS Safari and real Android devices (Stage 6 test matrix), screen readers, or any backend.

## What's deliberately fake
* Login, email confirmation, password reset and photo upload (Supabase Auth and Storage arrive in Stages 3–4).
* Notifications: none are sent.
* Account deletion: shows the manual-process message only.
* Legal pages: **placeholder text marked "Draft"**, not reviewed by a lawyer.
* Metrics come from this browser's demo data only.

## Feedback to collect before Stage 3 (5 target users, ~15 min each)
1. From the landing page alone, can they explain what this is and what it isn't (not a taxi)?
2. Do the 11 zone names make sense to them? Which zone is missing for *their* trip?
3. Is a "proposed contribution" clear? Would they settle it by cash or e-Transfer without friction?
4. **Drivers:** would they publish a trip they're already making? Is the 5-step form too long?
5. **Passengers:** what would they need to see before getting in a stranger's car?
6. Would the safety measures (public zones, hidden meeting point, report and block, no verification) be enough for them to try it?
