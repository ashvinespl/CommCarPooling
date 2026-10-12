-- Behavioural tests for the proposed schema: RLS, booking rules, privacy.
-- Run via ./run_tests.sh. Any failure aborts with a non-zero exit code.
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = notice;

create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false)
$$;
create function tests.expect_error(stmt text, pattern text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm !~* pattern then
      raise exception 'FAIL: expected error /%/ but got: %', pattern, sqlerrm;
    end if;
    raise notice 'PASS  rejected as expected: %', pattern;
    return;
  end;
  raise exception 'FAIL: expected error /%/ but statement succeeded: %', pattern, stmt;
end $$;
create function tests.check(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS  %', label;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- Fixed test identities
\set drv   '''11111111-1111-1111-1111-111111111111'''
\set p1    '''22222222-2222-2222-2222-222222222222'''
\set p2    '''33333333-3333-3333-3333-333333333333'''
\set p3    '''44444444-4444-4444-4444-444444444444'''
\set adm   '''55555555-5555-5555-5555-555555555555'''
insert into auth.users (id, email) values
  (:drv, 'driver@example.test'), (:p1, 'p1@example.test'), (:p2, 'p2@example.test'),
  (:p3, 'p3@example.test'), (:adm, 'admin@example.test');

-- ---------------------------------------------------------------- registration
set role authenticated;
select tests.login(:drv);
select complete_registration('Dana D.', 'Dana Driver', 'driver', '+1 604 555 0101', true, 'v0-draft', true);
select tests.login(:p1);
select complete_registration('Pat O.', 'Pat One', 'passenger', '+1 604 555 0102', true, 'v0-draft', false);
select tests.expect_error($$select complete_registration('Kid', 'Kid', 'passenger', null, false, 'v0-draft', false)$$, '18 or older');
select tests.login(:p2);
select complete_registration('Sam T.', 'Sam Two', 'passenger', null, true, 'v0-draft', false);
select tests.login(:p3);
select tests.expect_error($$select complete_registration('Ty T.', 'Ty Three', 'driver', null, true, 'v0-draft', false)$$, 'driver declaration');
select complete_registration('Ty T.', 'Ty Three', 'passenger', null, true, 'v0-draft', false);
select tests.login(:adm);
select complete_registration('Admin', 'Pilot Admin', 'passenger', null, true, 'v0-draft', false);
reset role;
insert into admins (user_id) values (:adm);

-- ---------------------------------------------------------------- publishing
set role authenticated;
select tests.login(:p1);
select tests.expect_error($$select publish_trip(2::smallint, 10::smallint, '{}', now() + interval '1 day', 2::smallint, 500)$$, 'Driver declaration required');

select tests.login(:drv);
select tests.expect_error($$select publish_trip(2::smallint, 10::smallint, '{}', now() + interval '5 minutes', 2::smallint, 500)$$, 'at least 15 minutes');
select tests.expect_error($$select publish_trip(2::smallint, 10::smallint, '{}', now() + interval '1 day', 2::smallint, 999999)$$, 'exceeds the pilot cap');
select tests.expect_error($$select publish_trip(2::smallint, 10::smallint, '{}', now() + interval '1 day', 9::smallint, 500)$$, 'Too many seats');
-- King George -> Newton -> South Surrey P&R -> White Rock Centre, 2 seats, $5
select publish_trip(2::smallint, 10::smallint, '{4,7}'::smallint[], now() + interval '1 day', 2::smallint, 500,
                    false, 'Small bag only', null, 'Bus bay 3, north side', 'Grey hatchback') as trip_id \gset
select tests.check(:'trip_id' is not null, 'driver publishes trip with intermediate stops');
select tests.expect_error($$update trips set seats_total = 6$$, 'permission denied');
select tests.expect_error($$update trips set contribution_cents = 0$$, 'permission denied');

-- ---------------------------------------------------------------- search (anon + authenticated)
reset role; set role anon; select tests.login(null);
select tests.check((select count(*) = 1 from search_trips(4::smallint, 10::smallint, ((now() + interval '1 day') at time zone 'America/Vancouver')::date)),
                   'anon search finds trip passing Newton -> White Rock');
select tests.check((select driver_display_name is null and driver_id is null from search_trips(4::smallint, 10::smallint, ((now() + interval '1 day') at time zone 'America/Vancouver')::date)),
                   'anon search does not reveal driver identity');
select tests.check((select count(*) = 0 from search_trips(10::smallint, 4::smallint, ((now() + interval '1 day') at time zone 'America/Vancouver')::date)),
                   'search respects direction (no reverse match)');
select tests.check((select count(*) = 0 from search_trips(4::smallint, 10::smallint, ((now() + interval '1 day') at time zone 'America/Vancouver')::date, null, null, 300)),
                   'contribution filter excludes $5 trip when max is $3');
select tests.expect_error($$select * from profiles$$, 'permission denied');
select tests.expect_error($$select * from trip_private_details$$, 'permission denied');
select tests.expect_error($$select * from analytics_events$$, 'permission denied');
insert into analytics_events (event_name, anon_id) values ('landing_view', gen_random_uuid());
select tests.check(true, 'anon can record a whitelisted analytics event');
select tests.expect_error($$insert into analytics_events (event_name, anon_id) values ('arbitrary_thing', gen_random_uuid())$$, 'check constraint');

reset role; set role authenticated;
select tests.login(:p1);
select tests.check((select driver_display_name = 'Dana D.' from search_trips(4::smallint, 10::smallint, ((now() + interval '1 day') at time zone 'America/Vancouver')::date)),
                   'signed-in passenger sees driver display name');

-- ---------------------------------------------------------------- privacy
select tests.check((select count(*) = 1 from profile_private), 'user sees only own private profile');
select tests.check((select count(*) = 0 from trip_private_details), 'exact meeting point hidden before acceptance');
select tests.expect_error($$update profile_private set account_status = 'active'$$, 'permission denied');
select tests.expect_error($$update profiles set created_at = now()$$, 'permission denied');
update profiles set bio = 'Hi!' where id = :drv;  -- someone else's row: silently 0 rows
select tests.check((select bio is null from profiles where id = :drv), 'cannot edit another user''s profile');

-- ---------------------------------------------------------------- booking rules
select tests.expect_error(format($$select request_seat(%L, 10::smallint, 4::smallint)$$, :'trip_id'), 'in order');
select tests.expect_error(format($$select request_seat(%L, 4::smallint, 10::smallint, 3::smallint)$$, :'trip_id'), 'Not enough seats');
select request_seat(:'trip_id', 4::smallint, 10::smallint) as b1 \gset
select tests.expect_error(format($$select request_seat(%L, 4::smallint, 10::smallint)$$, :'trip_id'), 'already have an active request');
select tests.expect_error(format($$select respond_to_booking(%L, true)$$, :'b1'), 'Only the driver');
select tests.login(:drv);
select tests.expect_error(format($$select request_seat(%L, 4::smallint, 10::smallint)$$, :'trip_id'), 'own trip');
select tests.login(:p2);
select request_seat(:'trip_id', 2::smallint, 7::smallint) as b2 \gset
select tests.check((select count(*) = 0 from bookings where id = :'b1'), 'passenger cannot see another passenger''s booking');
select tests.login(:p3);
select request_seat(:'trip_id', 7::smallint, 10::smallint) as b3 \gset

select tests.login(:drv);
select tests.check((select count(*) = 3 from bookings), 'driver sees all requests on own trip');
select tests.check(respond_to_booking(:'b1', true) = 'accepted', 'driver accepts P1');
select tests.check(respond_to_booking(:'b2', true) = 'accepted', 'driver accepts P2');
select tests.expect_error(format($$select respond_to_booking(%L, true)$$, :'b3'), 'Not enough seats');
select tests.expect_error(format($$select respond_to_booking(%L, true)$$, :'b1'), 'no longer pending');
select tests.check((select seats_booked = 2 from trips where id = :'trip_id'), 'seat count = 2 of 2');

select tests.login(:p1);
select tests.check((select meeting_point_detail = 'Bus bay 3, north side' from trip_private_details), 'accepted passenger sees exact meeting point');
select tests.login(:p3);
select tests.check((select count(*) = 0 from trip_private_details), 'pending passenger still cannot see meeting point');
select tests.check((select count(*) = 0 from search_trips(7::smallint, 10::smallint, ((now() + interval '1 day') at time zone 'America/Vancouver')::date)),
                   'full trip no longer appears in search');

-- cancellation frees the seat
select tests.login(:p2);
select cancel_booking(:'b2', 'Plans changed');
select tests.check((select status = 'cancelled' and not late_cancellation from bookings where id = :'b2'), 'early cancellation not flagged late');
select tests.login(:drv);
select tests.check((select seats_booked = 1 from trips where id = :'trip_id'), 'cancellation releases seat');
select tests.check(respond_to_booking(:'b3', true) = 'accepted', 'freed seat can be given to P3');

-- ---------------------------------------------------------------- messaging & blocking
select tests.login(:p1);
insert into booking_messages (booking_id, sender_id, body) values (:'b1', :p1, 'See you at the bus bay!');
select tests.check(true, 'passenger can message driver on live booking');
select tests.login(:p3);
select tests.expect_error(format($$insert into booking_messages (booking_id, sender_id, body) values (%L, %L, 'hi')$$, :'b1', :p3), 'row-level security');
select tests.check((select count(*) = 0 from booking_messages where booking_id = :'b1'), 'non-party cannot read messages');
select tests.login(:p2);
insert into blocks (blocker_id, blocked_id) values (:p2, :drv);
select tests.expect_error(format($$select request_seat(%L, 4::smallint, 10::smallint)$$, :'trip_id'), 'not available');
select tests.check((select count(*) = 0 from profiles where id = :drv), 'blocked user''s profile hidden');

-- ---------------------------------------------------------------- reports & admin
insert into reports (reporter_id, reported_id, trip_id, category, details) values (:p2, :drv, :'trip_id', 'safety_concern', 'test report');
select tests.expect_error(format($$insert into reports (reporter_id, category, details) values (%L, 'other', 'x')$$, :p1), 'row-level security');
select tests.login(:drv);
select tests.check((select count(*) = 0 from reports), 'reported user cannot see report against them');
select tests.expect_error(format($$select admin_set_account_status(%L, 'suspended', 'x')$$, :p2), 'admin only');
select tests.login(:adm);
select tests.check((select count(*) = 1 from reports), 'admin sees reports');
select tests.check((select count(*) = 5 from profile_private), 'admin sees all private profiles');
select admin_set_account_status(:p3, 'suspended', 'test suspension');
select tests.login(:p3);
select tests.expect_error(format($$select request_seat(%L, 4::smallint, 10::smallint)$$, :'trip_id'), 'account not active');

-- ---------------------------------------------------------------- feedback
select tests.login(:p1);
select tests.expect_error(format($$select submit_trip_feedback(%L, 'completed')$$, :'b1'), 'after departure');
reset role;
update trips set departure_at = now() - interval '1 hour' where id = :'trip_id';
set role authenticated;
select submit_trip_feedback(:'b1', 'completed', 'settled', 5::smallint, true, 20::smallint, 'bus', 400, true, 'Great');
select tests.check((select status = 'completed' from bookings where id = :'b1'), 'self-reported completion marks booking completed');
select tests.expect_error(format($$select submit_trip_feedback(%L, 'completed')$$, :'b1'), 'duplicate key');
select tests.login(:drv);
select tests.check((select count(*) = 0 from trip_feedback), 'driver cannot read passenger''s private feedback');

-- ---------------------------------------------------------------- driver cancels trip
select publish_trip(10::smallint, 2::smallint, '{}', now() + interval '1 hour', 1::smallint, 0) as trip2 \gset
select tests.login(:p1);
select request_seat(:'trip2', 10::smallint, 2::smallint) as b4 \gset
select tests.login(:drv);
select respond_to_booking(:'b4', true);
select cancel_trip(:'trip2', 'Car trouble');
select tests.check((select status = 'cancelled' and late_cancellation from bookings where id = :'b4'), 'driver trip cancellation within 2h flagged late');

reset role;
\echo 'ALL SEQUENTIAL TESTS PASSED'
