-- One seat, two pending requests; two concurrent accepts must yield exactly one success.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
reset role;
insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'c1@example.test'),
  ('77777777-7777-7777-7777-777777777777', 'c2@example.test');
set role authenticated;
select tests.login('66666666-6666-6666-6666-666666666666');
select complete_registration('C One', 'C One', 'passenger', null, true, 'v0-draft', false, true);
select tests.login('77777777-7777-7777-7777-777777777777');
select complete_registration('C Two', 'C Two', 'passenger', null, true, 'v0-draft', false, true);
select tests.login('11111111-1111-1111-1111-111111111111');
select publish_trip(9::smallint, 1::smallint, '{}', now() + interval '1 day', 1::smallint, 500) as t \gset
select tests.login('66666666-6666-6666-6666-666666666666');
select request_seat(:'t', 9::smallint, 1::smallint) as c1 \gset
select tests.login('77777777-7777-7777-7777-777777777777');
select request_seat(:'t', 9::smallint, 1::smallint) as c2 \gset
reset role;
\pset tuples_only on
\pset format unaligned
\o race_ids.txt
select :'t' || ' ' || :'c1' || ' ' || :'c2';
\o
