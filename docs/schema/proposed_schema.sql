-- =============================================================================
-- Community Carpooling Pilot (Surrey <-> White Rock) — PROPOSED schema (Stage 1)
-- =============================================================================
-- Status: design proposal for review. It becomes the first Supabase migration
-- in Stage 3 (supabase/migrations/...). It is tested locally against plain
-- PostgreSQL 16 with a stub of Supabase's `auth` schema (see tests/).
--
-- Design principles
--   * Every table has Row Level Security (RLS) enabled.
--   * Clients READ through RLS-protected tables/functions.
--   * Business-critical WRITES (publish trip, request/accept/cancel booking)
--     go through SECURITY DEFINER functions that check every rule in one place
--     and lock rows to prevent overbooking.
--   * Public data is separated from private data (phone, consents, exact
--     meeting point) by table, so a mistaken `select *` can't leak it.
--   * No payment or banking data is stored, ever, in the pilot.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.role_pref       as enum ('passenger', 'driver', 'both');
create type public.account_status  as enum ('active', 'suspended');
create type public.trip_status     as enum ('scheduled', 'cancelled', 'completed');
create type public.trip_type       as enum ('one_way', 'round_trip');
create type public.booking_status  as enum (
  'pending',    -- passenger requested, driver has not answered
  'accepted',   -- driver accepted; seat is held
  'declined',   -- driver declined
  'cancelled',  -- cancelled by passenger, driver, or trip cancellation
  'expired',    -- trip departed while still pending
  'completed'   -- at least one party reported the ride happened
);
create type public.ride_outcome    as enum (
  'completed', 'driver_no_show', 'passenger_no_show', 'cancelled', 'other'
);
create type public.settlement      as enum ('settled', 'not_settled', 'partially', 'waived', 'not_applicable');
create type public.report_category as enum (
  'safety_concern', 'harassment', 'no_show', 'late_cancellation',
  'unsafe_driving', 'commercial_activity', 'inappropriate_content', 'other'
);
create type public.report_status   as enum ('open', 'reviewing', 'actioned', 'dismissed');

-- -----------------------------------------------------------------------------
-- Pilot configuration (admin-editable, publicly readable)
-- -----------------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value, description) values
  ('max_contribution_cents', '1500',
   'Hard cap on proposed per-passenger contribution (CAD cents). Set ONLY after legal/insurance review of cost-recovery limits.'),
  ('late_cancel_hours', '2',
   'Cancelling an accepted booking within this many hours of departure is flagged as a late cancellation.'),
  ('max_days_ahead', '30',
   'Trips may be published at most this many days in advance.'),
  ('max_seats_per_trip', '4',
   'Upper bound on seats a driver may offer.');

-- -----------------------------------------------------------------------------
-- Pickup zones (manually configured; no geocoding or routing API needed)
-- Coordinates are approximate zone centres used only for display.
-- -----------------------------------------------------------------------------
create table public.pickup_zones (
  id           smallint generated always as identity primary key,
  slug         text not null unique,
  name         text not null,
  municipality text not null,
  description  text not null,          -- public, approximate ("near the bus loop")
  lat          numeric(8,5),
  lng          numeric(8,5),
  is_active    boolean not null default true,
  sort_order   smallint not null default 100
);

-- Seed zones are PLACEHOLDERS to validate with real users during the pilot.
insert into public.pickup_zones (slug, name, municipality, description, lat, lng, sort_order) values
  ('surrey-central',   'Surrey Central / City Centre',  'Surrey',       'Public area near Surrey Central SkyTrain', 49.18960, -122.84800, 10),
  ('king-george',      'King George Stn',               'Surrey',       'Public area near King George SkyTrain',    49.18280, -122.84470, 20),
  ('guildford',        'Guildford',                     'Surrey',       'Public area near Guildford Town Centre',  49.19060, -122.80330, 30),
  ('newton',           'Newton',                        'Surrey',       'Public area near Newton Exchange',        49.13240, -122.84280, 40),
  ('fleetwood',        'Fleetwood',                     'Surrey',       'Public area near Fleetwood Town Centre',  49.15310, -122.77530, 50),
  ('cloverdale',       'Cloverdale',                    'Surrey',       'Public area near Cloverdale town centre', 49.10450, -122.73370, 60),
  ('south-surrey-pnr', 'South Surrey Park & Ride',      'Surrey',       'Public transit park-and-ride area',       49.04240, -122.77830, 70),
  ('morgan-crossing',  'Morgan Crossing / Grandview',   'Surrey',       'Public area near Morgan Crossing',        49.04450, -122.69930, 80),
  ('semiahmoo',        'Semiahmoo Town Centre',         'Surrey',       'Public area near Semiahmoo Shopping Ctr', 49.03440, -122.80150, 90),
  ('white-rock-centre','White Rock Town Centre',        'White Rock',   'Public area near Johnston Rd & North Bluff', 49.02550, -122.80300, 100),
  ('white-rock-beach', 'White Rock Waterfront',         'White Rock',   'Public area near Marine Drive',            49.01700, -122.80450, 110);

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------

-- Public-facing profile. Contains NOTHING sensitive.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40), -- e.g. "Priya S."
  role_pref    public.role_pref not null default 'passenger',
  bio          text check (char_length(bio) <= 280),
  photo_path   text,                                -- Supabase Storage path; optional
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Private profile: visible to the user themselves and admins only.
create table public.profile_private (
  user_id                  uuid primary key references public.profiles (id) on delete cascade,
  full_name                text not null check (char_length(full_name) between 1 and 100),
  phone                    text check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  share_phone_after_accept boolean not null default false,
  age_confirmed_18_plus    boolean not null default false,
  terms_version            text not null,
  terms_accepted_at        timestamptz not null,
  privacy_accepted_at      timestamptz not null,
  safety_rules_accepted_at timestamptz not null,
  respect_pledge_at        timestamptz not null, -- pledge to treat drivers and passengers with respect
  -- Driver self-declarations (NOT verification — never displayed as "verified")
  driver_declared_at       timestamptz,     -- valid licence, valid insurance, personal (non-commercial) trips
  account_status           public.account_status not null default 'active',
  suspended_reason         text,
  suspended_at             timestamptz,
  acquisition_source       text check (char_length(acquisition_source) <= 60)  -- "how did you hear about us"
);

create table public.admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- -----------------------------------------------------------------------------
-- Trips
-- -----------------------------------------------------------------------------
create table public.trips (
  id                  uuid primary key default gen_random_uuid(),
  driver_id           uuid not null references public.profiles (id) on delete cascade,
  origin_zone_id      smallint not null references public.pickup_zones (id),
  destination_zone_id smallint not null references public.pickup_zones (id),
  departure_at        timestamptz not null,
  seats_total         smallint not null check (seats_total between 1 and 6),
  seats_booked        smallint not null default 0,
  contribution_cents  integer not null check (contribution_cents between 0 and 10000),
  trip_type           public.trip_type not null default 'one_way',
  return_trip_id      uuid references public.trips (id) on delete set null, -- round trip = two linked trips
  luggage_ok          boolean not null default false,
  notes               text check (char_length(notes) <= 500),
  accessibility_notes text check (char_length(accessibility_notes) <= 300),
  status              public.trip_status not null default 'scheduled',
  cancelled_reason    text check (char_length(cancelled_reason) <= 300),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (origin_zone_id <> destination_zone_id),
  check (seats_booked between 0 and seats_total)          -- DB-level overbooking guard
);
create index trips_search_idx on public.trips (status, departure_at);
create index trips_driver_idx on public.trips (driver_id, departure_at desc);

-- Ordered list of zones the trip passes through, INCLUDING origin (seq 0) and
-- destination (last seq). Matching = pickup zone appears before drop-off zone.
create table public.trip_stops (
  trip_id uuid not null references public.trips (id) on delete cascade,
  seq     smallint not null check (seq >= 0),
  zone_id smallint not null references public.pickup_zones (id),
  primary key (trip_id, seq),
  unique (trip_id, zone_id)
);
create index trip_stops_zone_idx on public.trip_stops (zone_id);

-- Exact meeting point & vehicle description: revealed only to the driver and
-- ACCEPTED passengers.
create table public.trip_private_details (
  trip_id              uuid primary key references public.trips (id) on delete cascade,
  meeting_point_detail text check (char_length(meeting_point_detail) <= 300),
  vehicle_description  text check (char_length(vehicle_description) <= 100)  -- "Grey Honda Civic"
);

-- -----------------------------------------------------------------------------
-- Bookings
-- -----------------------------------------------------------------------------
create table public.bookings (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips (id) on delete cascade,
  passenger_id      uuid not null references public.profiles (id) on delete cascade,
  seats             smallint not null default 1 check (seats between 1 and 4),
  pickup_zone_id    smallint not null references public.pickup_zones (id),
  dropoff_zone_id   smallint not null references public.pickup_zones (id),
  request_message   text check (char_length(request_message) <= 300),
  status            public.booking_status not null default 'pending',
  created_at        timestamptz not null default now(),
  responded_at      timestamptz,
  cancelled_at      timestamptz,
  cancelled_by      uuid references public.profiles (id),
  cancel_reason     text check (char_length(cancel_reason) <= 300),
  late_cancellation boolean not null default false
);
-- One live (pending/accepted) booking per passenger per trip.
create unique index bookings_one_live_per_trip
  on public.bookings (trip_id, passenger_id)
  where status in ('pending', 'accepted');
create index bookings_passenger_idx on public.bookings (passenger_id, created_at desc);
create index bookings_trip_idx on public.bookings (trip_id, status);

-- -----------------------------------------------------------------------------
-- Messaging (scoped to a booking; no phone numbers needed)
-- -----------------------------------------------------------------------------
create table public.booking_messages (
  id         bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index booking_messages_booking_idx on public.booking_messages (booking_id, created_at);

-- -----------------------------------------------------------------------------
-- Trust & safety
-- -----------------------------------------------------------------------------
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.profiles (id) on delete cascade,
  reported_id   uuid references public.profiles (id) on delete set null,
  trip_id       uuid references public.trips (id) on delete set null,
  booking_id    uuid references public.bookings (id) on delete set null,
  category      public.report_category not null,
  details       text not null check (char_length(details) between 1 and 2000),
  status        public.report_status not null default 'open',
  admin_notes   text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  check (reported_id is null or reported_id <> reporter_id)
);

-- Post-trip survey (one per participant per booking). Private: only the
-- author and admins can read it. No public star ratings in the pilot.
create table public.trip_feedback (
  id                     uuid primary key default gen_random_uuid(),
  booking_id             uuid not null references public.bookings (id) on delete cascade,
  author_id              uuid not null references public.profiles (id) on delete cascade,
  author_role            text not null check (author_role in ('driver', 'passenger')),
  outcome                public.ride_outcome not null,
  contribution_settled   public.settlement,
  rating                 smallint check (rating between 1 and 5),
  felt_safe              boolean,
  minutes_saved_estimate smallint check (minutes_saved_estimate between -240 and 240),
  alternative_mode       text check (alternative_mode in ('bus', 'skytrain_bus', 'taxi_ridehail', 'own_car', 'walk_bike', 'not_travel', 'other')),
  alternative_cost_cents integer check (alternative_cost_cents between 0 and 20000),
  would_use_again        boolean,
  comments               text check (char_length(comments) <= 1000),
  created_at             timestamptz not null default now(),
  unique (booking_id, author_id)
);

-- "I need a ride that isn't listed" — unmet demand signal.
create table public.ride_requests (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  origin_zone_id      smallint not null references public.pickup_zones (id),
  destination_zone_id smallint not null references public.pickup_zones (id),
  desired_date        date not null,
  earliest_time       time,
  latest_time         time,
  is_recurring        boolean not null default false,
  notes               text check (char_length(notes) <= 300),
  created_at          timestamptz not null default now(),
  check (origin_zone_id <> destination_zone_id)
);

-- -----------------------------------------------------------------------------
-- Analytics (first-party, privacy-conscious: no IP, no user agent string,
-- random per-browser anon_id, whitelisted event names)
-- -----------------------------------------------------------------------------
create table public.analytics_events (
  id         bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'landing_view', 'signup_started', 'signup_completed', 'login',
    'search_performed', 'search_no_results', 'trip_viewed',
    'booking_request_started', 'booking_request_abandoned', 'booking_requested',
    'publish_started', 'publish_abandoned', 'trip_published',
    'ride_request_submitted', 'feedback_submitted'
  )),
  anon_id    uuid not null,
  user_id    uuid references public.profiles (id) on delete set null,
  props      jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2000),
  created_at timestamptz not null default now()
);
create index analytics_events_name_time_idx on public.analytics_events (event_name, created_at);

-- Admin audit log
create table public.admin_actions (
  id          bigint generated always as identity primary key,
  admin_id    uuid not null references public.profiles (id),
  action      text not null,
  target_user uuid references public.profiles (id) on delete set null,
  target_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- Helper functions
-- =============================================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_active_user(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profile_private
                 where user_id = uid and account_status = 'active');
$$;

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public.setting_int(k text)
returns integer language sql stable security definer set search_path = public as $$
  select (value #>> '{}')::integer from public.app_settings where key = k;
$$;

-- Is the caller the driver of, or an accepted passenger on, this trip?
create or replace function public.is_trip_participant(t uuid, accepted_only boolean default true)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.trips where id = t and driver_id = auth.uid())
      or exists (select 1 from public.bookings
                 where trip_id = t and passenger_id = auth.uid()
                   and (status in ('accepted', 'completed')
                        or (not accepted_only and status = 'pending')));
$$;

create or replace function public.is_booking_party(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bookings bk join public.trips t on t.id = bk.trip_id
                 where bk.id = b and auth.uid() in (bk.passenger_id, t.driver_id));
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- Write API (SECURITY DEFINER RPCs). Called from the client via supabase.rpc().
-- =============================================================================

-- Complete registration after Supabase Auth sign-up.
create or replace function public.complete_registration(
  p_display_name text, p_full_name text, p_role public.role_pref,
  p_phone text, p_age_confirmed boolean, p_terms_version text,
  p_driver_declaration boolean, p_respect_pledge boolean, p_acquisition_source text default null
) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not p_age_confirmed then raise exception 'Users must be 18 or older'; end if;
  if p_role in ('driver', 'both') and not coalesce(p_driver_declaration, false) then
    raise exception 'Drivers must accept the driver declaration';
  end if;
  if not coalesce(p_respect_pledge, false) then
    raise exception 'Please agree to treat drivers and passengers with respect';
  end if;
  insert into profiles (id, display_name, role_pref) values (uid, p_display_name, p_role);
  insert into profile_private (user_id, full_name, phone, age_confirmed_18_plus, terms_version,
                               terms_accepted_at, privacy_accepted_at, safety_rules_accepted_at,
                               respect_pledge_at, driver_declared_at, acquisition_source)
  values (uid, p_full_name, nullif(p_phone, ''), true, p_terms_version, now(), now(), now(), now(),
          case when p_driver_declaration then now() end, p_acquisition_source);
end $$;

-- Publish a trip. p_via_zone_ids are optional intermediate stops, in order.
create or replace function public.publish_trip(
  p_origin smallint, p_destination smallint, p_via_zone_ids smallint[],
  p_departure_at timestamptz, p_seats smallint, p_contribution_cents integer,
  p_luggage_ok boolean default false, p_notes text default null,
  p_accessibility_notes text default null, p_meeting_point text default null,
  p_vehicle_description text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  z smallint;
  i int := 1;
begin
  if uid is null or not is_active_user(uid) then raise exception 'account not active'; end if;
  if not exists (select 1 from profile_private where user_id = uid and driver_declared_at is not null) then
    raise exception 'Driver declaration required before publishing trips';
  end if;
  if p_departure_at < now() + interval '15 minutes' then
    raise exception 'Departure must be at least 15 minutes in the future';
  end if;
  if p_departure_at > now() + make_interval(days => setting_int('max_days_ahead')) then
    raise exception 'Departure is too far in the future';
  end if;
  if p_seats > setting_int('max_seats_per_trip') then raise exception 'Too many seats'; end if;
  if p_contribution_cents > setting_int('max_contribution_cents') then
    raise exception 'Contribution exceeds the pilot cap';
  end if;

  insert into trips (driver_id, origin_zone_id, destination_zone_id, departure_at, seats_total,
                     contribution_cents, luggage_ok, notes, accessibility_notes)
  values (uid, p_origin, p_destination, p_departure_at, p_seats, p_contribution_cents,
          p_luggage_ok, p_notes, p_accessibility_notes)
  returning id into new_id;

  insert into trip_stops (trip_id, seq, zone_id) values (new_id, 0, p_origin);
  foreach z in array coalesce(p_via_zone_ids, '{}') loop
    insert into trip_stops (trip_id, seq, zone_id) values (new_id, i, z);
    i := i + 1;
  end loop;
  insert into trip_stops (trip_id, seq, zone_id) values (new_id, i, p_destination);

  insert into trip_private_details (trip_id, meeting_point_detail, vehicle_description)
  values (new_id, p_meeting_point, p_vehicle_description);
  return new_id;
end $$;

-- Link two published trips as a round trip (outbound + return).
create or replace function public.link_round_trip(p_outbound uuid, p_return uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from trips where id in (p_outbound, p_return) and driver_id = auth.uid()) <> 2 then
    raise exception 'Both trips must belong to you';
  end if;
  update trips set trip_type = 'round_trip', return_trip_id = p_return where id = p_outbound;
  update trips set trip_type = 'round_trip', return_trip_id = p_outbound where id = p_return;
end $$;

-- Search: trips whose stop list contains pickup BEFORE drop-off.
create or replace function public.search_trips(
  p_pickup smallint, p_dropoff smallint, p_date date,
  p_earliest time default null, p_latest time default null,
  p_max_contribution_cents integer default null, p_min_seats smallint default 1
) returns table (
  trip_id uuid, driver_id uuid, driver_display_name text, departure_at timestamptz,
  origin_zone_id smallint, destination_zone_id smallint,
  seats_available integer, contribution_cents integer, luggage_ok boolean
) language sql stable security definer set search_path = public as $$
  -- SECURITY DEFINER so anonymous visitors can search; returns only public-safe
  -- columns, and the driver's display name only to signed-in users.
  select t.id,
         case when auth.uid() is not null then t.driver_id end,
         case when auth.uid() is not null then p.display_name end,
         t.departure_at,
         t.origin_zone_id, t.destination_zone_id,
         (t.seats_total - t.seats_booked)::int, t.contribution_cents, t.luggage_ok
  from trips t
  join trip_stops sp on sp.trip_id = t.id and sp.zone_id = p_pickup
  join trip_stops sd on sd.trip_id = t.id and sd.zone_id = p_dropoff and sd.seq > sp.seq
  left join profiles p on p.id = t.driver_id
  where t.status = 'scheduled'
    and t.departure_at > now()
    and (t.departure_at at time zone 'America/Vancouver')::date = p_date
    and (p_earliest is null or (t.departure_at at time zone 'America/Vancouver')::time >= p_earliest)
    and (p_latest   is null or (t.departure_at at time zone 'America/Vancouver')::time <= p_latest)
    and (p_max_contribution_cents is null or t.contribution_cents <= p_max_contribution_cents)
    and t.seats_total - t.seats_booked >= coalesce(p_min_seats, 1)
    and (auth.uid() is null or (t.driver_id <> auth.uid() and not is_blocked_between(auth.uid(), t.driver_id)))
  order by t.departure_at;
$$;

create or replace function public.request_seat(
  p_trip uuid, p_pickup smallint, p_dropoff smallint,
  p_seats smallint default 1, p_message text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  t trips%rowtype;
  new_id uuid;
begin
  if uid is null or not is_active_user(uid) then raise exception 'account not active'; end if;
  select * into t from trips where id = p_trip;
  if not found or t.status <> 'scheduled' or t.departure_at <= now() then
    raise exception 'Trip is not open for requests';
  end if;
  if t.driver_id = uid then raise exception 'You cannot book your own trip'; end if;
  if is_blocked_between(uid, t.driver_id) then raise exception 'Trip is not available'; end if;
  if not exists (
    select 1 from trip_stops sp join trip_stops sd on sd.trip_id = sp.trip_id
    where sp.trip_id = p_trip and sp.zone_id = p_pickup and sd.zone_id = p_dropoff and sd.seq > sp.seq
  ) then
    raise exception 'Pickup and drop-off must be on this trip''s route, in order';
  end if;
  if t.seats_total - t.seats_booked < p_seats then raise exception 'Not enough seats available'; end if;

  begin
    insert into bookings (trip_id, passenger_id, seats, pickup_zone_id, dropoff_zone_id, request_message)
    values (p_trip, uid, p_seats, p_pickup, p_dropoff, p_message)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'You already have an active request for this trip';
  end;
  return new_id;
end $$;

-- Driver accepts or declines. Row-locks the trip so concurrent accepts can't
-- overbook; the CHECK on trips.seats_booked is the final safety net.
create or replace function public.respond_to_booking(p_booking uuid, p_accept boolean)
returns public.booking_status language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b bookings%rowtype;
  t trips%rowtype;
begin
  select * into b from bookings where id = p_booking;
  if not found then raise exception 'Booking not found'; end if;
  select * into t from trips where id = b.trip_id for update;       -- serialize per trip
  if t.driver_id <> uid then raise exception 'Only the driver can respond'; end if;
  select * into b from bookings where id = p_booking for update;    -- re-read under lock
  if b.status <> 'pending' then raise exception 'Booking is no longer pending'; end if;
  if t.status <> 'scheduled' or t.departure_at <= now() then raise exception 'Trip is not open'; end if;

  if p_accept then
    if t.seats_total - t.seats_booked < b.seats then raise exception 'Not enough seats available'; end if;
    update trips set seats_booked = seats_booked + b.seats where id = t.id;
    update bookings set status = 'accepted', responded_at = now() where id = b.id;
    return 'accepted';
  else
    update bookings set status = 'declined', responded_at = now() where id = b.id;
    return 'declined';
  end if;
end $$;

create or replace function public.cancel_booking(p_booking uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b bookings%rowtype;
  t trips%rowtype;
begin
  select * into b from bookings where id = p_booking;
  if not found then raise exception 'Booking not found'; end if;
  select * into t from trips where id = b.trip_id for update;
  select * into b from bookings where id = p_booking for update;
  if uid not in (b.passenger_id, t.driver_id) then raise exception 'Not your booking'; end if;
  if b.status not in ('pending', 'accepted') then raise exception 'Booking cannot be cancelled'; end if;

  if b.status = 'accepted' then
    update trips set seats_booked = seats_booked - b.seats where id = t.id;
  end if;
  update bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = uid, cancel_reason = p_reason,
         late_cancellation = (b.status = 'accepted'
                              and t.departure_at - now() < make_interval(hours => setting_int('late_cancel_hours')))
   where id = b.id;
end $$;

-- Drivers may decline a passenger at any time, before or during the ride.
-- Not counted as a late cancellation; the seat is released. Admins can see
-- these via cancelled_by/cancel_reason on bookings that had been accepted.
create or replace function public.driver_decline_booking(p_booking uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  b bookings%rowtype;
  t trips%rowtype;
begin
  select * into b from bookings where id = p_booking;
  if not found then raise exception 'Booking not found'; end if;
  select * into t from trips where id = b.trip_id for update;
  if t.driver_id <> auth.uid() then raise exception 'Only the driver can decline this booking'; end if;
  select * into b from bookings where id = p_booking for update;
  if b.status not in ('pending', 'accepted') then raise exception 'This booking can no longer be declined'; end if;
  if b.status = 'accepted' then
    update trips set seats_booked = seats_booked - b.seats where id = t.id;
  end if;
  update bookings
     set status = 'declined', responded_at = coalesce(responded_at, now()),
         cancelled_at = case when b.status = 'accepted' then now() end,
         cancelled_by = auth.uid(), cancel_reason = p_reason, late_cancellation = false
   where id = b.id;
end $$;

create or replace function public.cancel_trip(p_trip uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t trips%rowtype;
begin
  select * into t from trips where id = p_trip for update;
  if not found or t.driver_id <> auth.uid() then raise exception 'Not your trip'; end if;
  if t.status <> 'scheduled' then raise exception 'Trip is not scheduled'; end if;
  update bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = coalesce(p_reason, 'Trip cancelled by driver'),
         late_cancellation = (status = 'accepted'
                              and t.departure_at - now() < make_interval(hours => setting_int('late_cancel_hours')))
   where trip_id = p_trip and status in ('pending', 'accepted');
  update trips set status = 'cancelled', seats_booked = 0, cancelled_reason = p_reason where id = p_trip;
end $$;

-- Post-trip survey. Allowed after departure, for driver or booked passenger.
create or replace function public.submit_trip_feedback(
  p_booking uuid, p_outcome public.ride_outcome, p_settled public.settlement default null,
  p_rating smallint default null, p_felt_safe boolean default null,
  p_minutes_saved smallint default null, p_alternative_mode text default null,
  p_alternative_cost_cents integer default null, p_would_use_again boolean default null,
  p_comments text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b bookings%rowtype;
  t trips%rowtype;
  r text;
begin
  select * into b from bookings where id = p_booking;
  select * into t from trips where id = b.trip_id;
  if not found then raise exception 'Booking not found'; end if;
  if uid = t.driver_id then r := 'driver';
  elsif uid = b.passenger_id then r := 'passenger';
  else raise exception 'Not your booking'; end if;
  if b.status not in ('accepted', 'completed') then raise exception 'Only accepted bookings can be reviewed'; end if;
  if t.departure_at > now() then raise exception 'Feedback opens after departure'; end if;

  insert into trip_feedback (booking_id, author_id, author_role, outcome, contribution_settled, rating,
                             felt_safe, minutes_saved_estimate, alternative_mode, alternative_cost_cents,
                             would_use_again, comments)
  values (p_booking, uid, r, p_outcome, p_settled, p_rating, p_felt_safe, p_minutes_saved,
          p_alternative_mode, p_alternative_cost_cents, p_would_use_again, p_comments);

  if p_outcome = 'completed' and b.status = 'accepted' then
    update bookings set status = 'completed' where id = b.id;
  end if;
end $$;

-- Admin: suspend / reinstate
create or replace function public.admin_set_account_status(
  p_user uuid, p_status public.account_status, p_reason text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update profile_private
     set account_status = p_status,
         suspended_reason = case when p_status = 'suspended' then p_reason end,
         suspended_at     = case when p_status = 'suspended' then now() end
   where user_id = p_user;
  insert into admin_actions (admin_id, action, target_user, details)
  values (auth.uid(), 'set_account_status', p_user, jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;

-- Scheduled maintenance (pg_cron, every 15 min in Stage 4): expire stale
-- pending requests and close out departed trips.
create or replace function public.expire_departed()
returns void language sql security definer set search_path = public as $$
  update bookings b set status = 'expired'
    from trips t where t.id = b.trip_id and b.status = 'pending' and t.departure_at <= now();
  update trips set status = 'completed'
   where status = 'scheduled' and departure_at < now() - interval '6 hours';
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.app_settings         enable row level security;
alter table public.pickup_zones         enable row level security;
alter table public.profiles             enable row level security;
alter table public.profile_private      enable row level security;
alter table public.admins               enable row level security;
alter table public.blocks               enable row level security;
alter table public.trips                enable row level security;
alter table public.trip_stops           enable row level security;
alter table public.trip_private_details enable row level security;
alter table public.bookings             enable row level security;
alter table public.booking_messages     enable row level security;
alter table public.reports              enable row level security;
alter table public.trip_feedback        enable row level security;
alter table public.ride_requests        enable row level security;
alter table public.analytics_events     enable row level security;
alter table public.admin_actions        enable row level security;

-- Start from zero privileges for API roles, then grant explicitly.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Reference data
grant select on public.app_settings, public.pickup_zones to anon, authenticated;
create policy settings_read on public.app_settings for select using (true);
create policy zones_read    on public.pickup_zones for select using (is_active or public.is_admin());
grant insert, update on public.pickup_zones, public.app_settings to authenticated;
create policy zones_admin_ins    on public.pickup_zones for insert to authenticated with check (public.is_admin());
create policy zones_admin_upd    on public.pickup_zones for update to authenticated using (public.is_admin());
create policy settings_admin_ins on public.app_settings for insert to authenticated with check (public.is_admin());
create policy settings_admin_upd on public.app_settings for update to authenticated using (public.is_admin());

-- Profiles: signed-in users see public profiles (blocked users hidden); owner edits limited columns.
grant select on public.profiles to authenticated;
grant update (display_name, role_pref, bio, photo_path) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or not public.is_blocked_between(auth.uid(), id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Private profile: self + admin. Self may change only phone and sharing flag.
grant select on public.profile_private to authenticated;
grant update (phone, share_phone_after_accept) on public.profile_private to authenticated;
create policy private_read on public.profile_private for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy private_update_own on public.profile_private for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin list: admins only
grant select on public.admins to authenticated;
create policy admins_read on public.admins for select to authenticated using (public.is_admin());

-- Blocks: own rows
grant select, insert, delete on public.blocks to authenticated;
create policy blocks_own_read on public.blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_own_ins  on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_own_del  on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- Trips: upcoming scheduled trips are publicly browsable (zones only, no
-- personal info); participants and admins see everything relevant.
grant select on public.trips, public.trip_stops to anon, authenticated;
create policy trips_read on public.trips for select
  using ((status = 'scheduled' and departure_at > now())
         or driver_id = auth.uid()
         or public.is_trip_participant(id, false)
         or public.is_admin());
create policy trip_stops_read on public.trip_stops for select
  using (exists (select 1 from public.trips t where t.id = trip_id));  -- inherits trips RLS
grant update (notes, accessibility_notes, luggage_ok) on public.trips to authenticated;
create policy trips_update_own on public.trips for update to authenticated
  using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- Exact meeting point: driver + ACCEPTED passengers + admin
grant select on public.trip_private_details to authenticated;
grant update (meeting_point_detail, vehicle_description) on public.trip_private_details to authenticated;
create policy tpd_read on public.trip_private_details for select to authenticated
  using (public.is_trip_participant(trip_id, true) or public.is_admin());
create policy tpd_update on public.trip_private_details for update to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid()));

-- Bookings: passenger, trip driver, admin. Writes only via RPCs.
grant select on public.bookings to authenticated;
create policy bookings_read on public.bookings for select to authenticated
  using (passenger_id = auth.uid()
         or exists (select 1 from public.trips t where t.id = trip_id and t.driver_id = auth.uid())
         or public.is_admin());

-- Messages: booking parties; send only while booking is live and not blocked.
grant select, insert on public.booking_messages to authenticated;
create policy msgs_read on public.booking_messages for select to authenticated
  using (public.is_booking_party(booking_id) or public.is_admin());
create policy msgs_insert on public.booking_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_active_user(auth.uid())
    and public.is_booking_party(booking_id)
    and exists (
      select 1 from public.bookings b join public.trips t on t.id = b.trip_id
      where b.id = booking_id and b.status in ('pending', 'accepted')
        and not public.is_blocked_between(b.passenger_id, t.driver_id)));

-- Reports: anyone signed in can file; only admins read/update.
grant insert, select on public.reports to authenticated;
grant update (status, admin_notes, resolved_at) on public.reports to authenticated;
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and admin_notes is null);
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated using (public.is_admin());

-- Feedback: written via RPC; readable by author + admin.
grant select on public.trip_feedback to authenticated;
create policy feedback_read on public.trip_feedback for select to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- Ride requests (unmet demand): own rows + admin.
grant select, insert, delete on public.ride_requests to authenticated;
create policy rr_read   on public.ride_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy rr_insert on public.ride_requests for insert to authenticated with check (user_id = auth.uid());
create policy rr_delete on public.ride_requests for delete to authenticated using (user_id = auth.uid());

-- Analytics: write-only for clients; admins read.
grant insert on public.analytics_events to anon, authenticated;
grant select on public.analytics_events to authenticated;
create policy events_insert on public.analytics_events for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
create policy events_admin_read on public.analytics_events for select to authenticated using (public.is_admin());

grant select on public.admin_actions to authenticated;
create policy admin_actions_read on public.admin_actions for select to authenticated using (public.is_admin());

-- RPC execute grants
grant execute on function public.search_trips(smallint, smallint, date, time, time, integer, smallint) to anon, authenticated;
grant execute on function public.is_admin(), public.is_active_user(uuid), public.is_blocked_between(uuid, uuid),
                          public.is_trip_participant(uuid, boolean), public.is_booking_party(uuid),
                          public.setting_int(text)
  to anon, authenticated;
grant execute on function
  public.complete_registration(text, text, public.role_pref, text, boolean, text, boolean, boolean, text),
  public.publish_trip(smallint, smallint, smallint[], timestamptz, smallint, integer, boolean, text, text, text, text),
  public.link_round_trip(uuid, uuid),
  public.request_seat(uuid, smallint, smallint, smallint, text),
  public.respond_to_booking(uuid, boolean),
  public.cancel_booking(uuid, text),
  public.driver_decline_booking(uuid, text),
  public.cancel_trip(uuid, text),
  public.submit_trip_feedback(uuid, public.ride_outcome, public.settlement, smallint, boolean, smallint, text, integer, boolean, text),
  public.admin_set_account_status(uuid, public.account_status, text)
  to authenticated;
-- expire_departed(): service role / pg_cron only (no grant to API roles).

-- =============================================================================
-- Admin reporting views (anonymized; read through is_admin()-gated RPC in Stage 5)
-- =============================================================================
create view public.v_pilot_daily_metrics with (security_invoker = true) as
select d::date as day,
  (select count(*) from public.profiles p where p.created_at::date = d::date)                      as new_users,
  (select count(*) from public.trips t where t.created_at::date = d::date)                         as trips_published,
  (select count(*) from public.bookings b where b.created_at::date = d::date)                      as seat_requests,
  (select count(*) from public.bookings b where b.responded_at::date = d::date and (b.status <> 'declined' or b.cancelled_at is not null)) as requests_accepted,
  (select count(*) from public.bookings b where b.cancelled_at::date = d::date)                    as cancellations,
  (select count(*) from public.trip_feedback f where f.created_at::date = d::date and f.outcome = 'completed') as completed_reports,
  (select count(*) from public.trip_feedback f where f.created_at::date = d::date and f.outcome in ('driver_no_show','passenger_no_show')) as no_show_reports
from generate_series(date '2026-01-01', current_date, interval '1 day') d;
grant select on public.v_pilot_daily_metrics to authenticated;  -- RLS on base tables limits non-admins to their own rows
