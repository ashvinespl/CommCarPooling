# Prioritized Implementation Plan, Architecture & Budget

## 1. Architecture

```
 Browser (mobile-first PWA-ready SPA)
   React 18 + TypeScript + Vite · Tailwind CSS · React Router · TanStack Query · Zod forms
   └─ src/services/*  ← typed wrappers around supabase-js (the only place that talks to the backend)
          │  HTTPS (anon key + user JWT; RLS enforced)
          ▼
 Supabase project (region: ca-central-1 / Canada, if available on the chosen plan)
   ├─ Auth (email+password, email confirmation, custom SMTP)
   ├─ Postgres: tables + RLS + SECURITY DEFINER RPCs (docs/schema/proposed_schema.sql)
   ├─ Storage: `avatars` bucket (authenticated read, owner write, 2 MB, images only)
   ├─ pg_cron: expire_departed() every 15 min
   └─ Edge Functions (Deno): send-notification (DB webhook → email), admin-export-csv
          │
          ▼
 Transactional email provider (e.g., Resend or Brevo free tier)

 Static hosting: Cloudflare Pages or Netlify free tier (Vercel Hobby is restricted to non-commercial use, so check its terms)
```

**Why this stack:** one managed backend (auth + DB + storage + functions) keeps the moving parts small for a solo evenings-and-weekends builder; RLS + RPCs give real server-side authorization without running an API server; the `services/` layer and DB-function API make a future React Native app, payments (e.g., Stripe Connect) or push notifications additive rather than a rewrite.

**Maps decision:** **no maps API in the pilot.** Matching is zone-based, and zone locations can open a free `https://www.google.com/maps/search/?api=1&query=lat,lng` link (a URL, not an API, so no key or billing). Revisit Mapbox or Google Maps only if users say they need a map to understand zones. Mapbox has a free monthly tier for web map loads. Check current pricing at that time.

**Secrets:** `.env` holds only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public by design; RLS protects data). The service-role key and email API key live only in Supabase Edge Function secrets. `.env*` is git-ignored, and CI runs a secret scan.

## 2. Stages (owner review gate after each)

Effort assumes ~8–10 h/week of evening and weekend time. Estimates are rough.

| Stage | Deliverables | Est. effort | Exit criteria |
|---|---|---|---|
| **1. Requirements** ✅ *(this PR/branch)* | PRD, journeys, data model + tested proposed schema, screen list, plan, legal/safety register | done | Owner review and sign-off of scope, zones, contribution cap approach |
| **2. Clickable prototype** | Vite + React + TS + Tailwind app with all P0 screens using **mock data** (realistic Surrey/White Rock sample trips), mobile-first, deployed to a free preview URL | 10–14 h | Owner can click through J1–J7 on a phone; ~5 target users give feedback on clarity |
| **3. Auth, DB, publish & search** | Supabase project; migration from the proposed schema; auth + onboarding + consents; publish trip; search; trip detail; RLS tests ported to pgTAP; CI (typecheck, lint, unit, DB tests) | 16–22 h | Real sign-up → publish → search works on staging; DB tests green in CI |
| **4. Booking & profiles** | Request/accept/decline/cancel; bookings hub; messages (Supabase Realtime or polling); profile + photo upload; history; expiry cron; email notifications (request, accept, cancel) | 18–24 h | Two real phones can complete J3/J4 end-to-end; concurrency test green |
| **5. Trust, feedback & analytics** | Report/block UI; post-trip survey; unmet-demand form; first-party events; admin dashboard, users/reports/trips; suspend; anonymized CSV export | 16–22 h | Admin can triage a report and export metrics; events visible |
| **6. Hardening** | Mobile/browser test matrix (iOS Safari, Android Chrome, desktop); authorization test sweep; race tests; privacy review (no PII in logs/exports); error handling; accessibility pass; rate limiting; Supabase security advisor clean | 10–14 h | Checklist complete; known issues documented |
| **7. Launch prep** | Deployment checklist; legal docs in place (lawyer-reviewed); incident procedure; 4-week pilot operating plan; recruitment materials; backup/restore test | 6–10 h + external review time | Legal/insurance blockers resolved (see `06`) → go/no-go decision |

**Total build:** ~75–105 h → roughly **9–12 weeks** of evenings and weekends, then a **4-week pilot**. The legal review should start **in parallel during Stage 2**, because it's the most likely critical-path item.

## 3. Priority order inside the build (if time runs short, cut from the bottom)
1. Auth + consent + private/public profile split
2. Publish trip (zones) + search + trip detail
3. Request / accept / decline with seat integrity
4. Cancel + booking status hub
5. Report + block + admin suspend + report triage
6. Booking messages
7. Post-trip survey + settlement self-report
8. Analytics events + CSV export
9. Email notifications (request/accept/cancel), then reminders
10. Unmet-demand form
11. Admin KPI dashboard (CSV + spreadsheet can stand in)
12. Round trips, duplicate trip, phone sharing, abandonment prompts (P1/P2)

## 4. Budget (CAD, rough estimates; verify current prices before purchase)

| Item | One-time | Recurring (pilot) | Notes |
|---|---|---|---|
| Domain name (.ca or .com) | $15–30 | – | .ca requires Canadian presence (CIRA rules) |
| Hosting (Cloudflare Pages / Netlify) | – | $0 | Free tiers sufficient at pilot scale |
| Supabase | – | $0 during build; **~$35/mo** (USD $25 Pro) for the ~2 live pilot months | Free projects pause after inactivity and lack daily backups. Pro recommended once real users join |
| Transactional email | – | $0 | Free tiers (low thousands/month) suffice. Supabase's built-in SMTP is for testing only |
| Maps API | – | $0 | Not used in pilot (see §1) |
| **Legal review**: PTA/TNS classification opinion, Terms, Privacy Notice, waiver/limitation clauses | **$1,500–3,500** | – | Largest and most important cost; get fixed-fee quotes |
| Business liability insurance quote/policy (platform operator) | TBD (quote) | TBD | Ask a broker; may be $1,000+/yr; decide with legal advice |
| Pilot recruitment (flyers, posters, small social ads) | $150–400 | – | Community boards, campuses, workplaces |
| Participant incentives (e.g., draw for survey completers) | $100–300 | – | Check contest rules with legal |
| Contingency | $200 | – | |
| **Total (excluding insurance)** | | | **≈ $2,050–4,500** |

**API cost exposure is low by design:** no maps API, no SMS, no payments. The main variable cost risk is Supabase plan overages, which are unlikely at < 500 users. A spend cap is on by default on Supabase Pro. Keep it on.

## 5. Manual configuration the owner must do (cannot be done from code)
* Create the Supabase project (choose a Canada region if offered), enable email confirmation, set the Site URL and redirect URLs, configure custom SMTP, and enable `pg_cron`.
* Create the email provider account; verify the sending domain (DNS SPF/DKIM records).
* Buy the domain; connect DNS to the hosting provider.
* Add the first admin with `insert into admins (user_id) values ('<uuid>');` in the SQL editor.
* Finalize pickup zones (visit each; confirm it's a public place with legal stopping, e.g., not a bus stop where stopping for private vehicles is prohibited).
* Engage a lawyer, contact ICBC/broker, and complete the items in `06-legal-safety-privacy.md`.

## 6. Testing approach (all stages)
* **DB:** SQL behaviour tests (now: `docs/schema/tests/run_tests.sh`; Stage 3+: pgTAP via the Supabase CLI) covering every RLS policy and RPC, including the concurrency test.
* **Frontend:** Vitest + React Testing Library for forms and services; Playwright smoke tests for J1–J4 at mobile viewport (Chromium; WebKit where available).
* **CI:** GitHub Actions: typecheck, lint, unit tests, DB tests, build. Free for this usage level (check minutes on private repos).
* Test results are reported as run. Nothing is marked as passing unless it ran.
