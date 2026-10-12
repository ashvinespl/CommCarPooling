#!/usr/bin/env bash
# Spins up a throwaway local PostgreSQL, loads a Supabase auth stub + the
# proposed schema, and runs behavioural tests (RLS, booking rules, privacy,
# concurrent-accept race). Requires PostgreSQL 15+ binaries on PATH or PG_BIN.
# Usage: ./run_tests.sh      (must not run as root; initdb refuses)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCHEMA="$HERE/../proposed_schema.sql"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || echo /usr/lib/postgresql/16/bin/initdb)")}"
WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres

cleanup() { "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"$PG_BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"$PG_BIN/pg_ctl" -D "$WORK/data" -l "$WORK/pg.log" -o "-k $WORK -p $PORT -c listen_addresses='' -c timezone=UTC" -w start >/dev/null

PSQL=("$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1)
echo "== Loading Supabase stub"
"${PSQL[@]}" -f "$HERE/supabase_stub.sql"
echo "== Loading proposed schema"
"${PSQL[@]}" -f "$SCHEMA"
echo "== Sequential tests"
"${PSQL[@]}" -o /dev/null -f "$HERE/schema_tests.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
test "${PIPESTATUS[0]}" -eq 0

echo "== Concurrency test: two simultaneous accepts for the last seat"
(cd "$WORK" && "${PSQL[@]}" -f "$HERE/concurrency_setup.sql")
read -r TRIP C1 C2 < "$WORK/race_ids.txt"
accept() {  # $1 booking id; holds the transaction open briefly to force overlap
  "${PSQL[@]}" -t -A <<SQL 2>&1 || true
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select respond_to_booking('$1', true);
select pg_sleep(1);
commit;
SQL
}
accept "$C1" > "$WORK/r1.txt" & accept "$C2" > "$WORK/r2.txt" & wait
OK=$(cat "$WORK"/r1.txt "$WORK"/r2.txt | grep -c '^accepted$' || true)
FULL=$(cat "$WORK"/r1.txt "$WORK"/r2.txt | grep -c 'Not enough seats' || true)
BOOKED=$("${PSQL[@]}" -t -A -c "select seats_booked from trips where id = '$TRIP'")
echo "  accepted=$OK rejected_full=$FULL seats_booked=$BOOKED"
if [ "$OK" = 1 ] && [ "$FULL" = 1 ] && [ "$BOOKED" = 1 ]; then
  echo "  PASS  exactly one concurrent accept succeeded; no overbooking"
else
  echo "  FAIL  race condition test"; cat "$WORK"/r1.txt "$WORK"/r2.txt; exit 1
fi
echo "== ALL TESTS PASSED"
