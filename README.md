# CommCarPooling — Community Carpooling Pilot (Surrey ↔ White Rock, BC)

A mobile-first web app that connects people already driving between Surrey, South Surrey and White Rock with neighbours who want a seat, sharing the trip cost through a **proposed contribution** (not a fare). The pilot runs for 4 weeks and tests whether demand exists. It does not assume it.

> ⚠️ **Pre-launch.** Legal, insurance and privacy review is **not** complete. See [docs/06-legal-safety-privacy.md](docs/06-legal-safety-privacy.md). Do not describe this platform as compliant, insured or verified.

## Status

| Stage | Description | Status |
|---|---|---|
| 1 | PRD, user journeys, data model, screen list, plan | ✅ Ready for review |
| 2 | Clickable UI prototype (mock data) | ⏳ Waiting for Stage 1 sign-off |
| 3 | Auth, DB, RLS, publish & search | – |
| 4 | Booking, seats, cancellation, profiles | – |
| 5 | Reporting, feedback, analytics, admin | – |
| 6 | Hardening & testing | – |
| 7 | Deployment checklist & pilot operating plan | – |

## Stage 1 documents

1. [Product requirements](docs/01-product-requirements.md): hypotheses, scope, priorities, contribution and cancellation rules, metrics
2. [User journeys](docs/02-user-journeys.md): key flows, edge cases, booking state machine
3. [Data model & access control](docs/03-data-model.md), with [proposed SQL schema](docs/schema/proposed_schema.sql)
4. [Screen list & UX notes](docs/04-screen-list.md)
5. [Implementation plan, architecture & budget](docs/05-implementation-plan.md)
6. [Legal, safety & privacy open items](docs/06-legal-safety-privacy.md)

## Planned stack
React + TypeScript (Vite, Tailwind) · Supabase (Postgres, Auth, RLS, Storage, Edge Functions) · static hosting on a free tier · no maps API in the pilot (zone-based matching).

## Running the schema tests

Requires PostgreSQL 15+ binaries (`initdb`, `pg_ctl`, `psql`). Run as a non-root user:

```bash
PG_BIN=/usr/lib/postgresql/16/bin ./docs/schema/tests/run_tests.sh
```

This starts a throwaway database, loads a stub of Supabase's `auth` schema, applies the proposed schema, and runs 58 behavioural checks (RLS, privacy, booking rules) plus a concurrent "last seat" race test.
