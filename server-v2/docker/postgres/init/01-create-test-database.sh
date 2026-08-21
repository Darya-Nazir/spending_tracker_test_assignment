#!/bin/sh
set -eu

test_database=${POSTGRES_TEST_DB:-spending_test}

psql \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 \
    --set=test_database="$test_database" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER %I', :'test_database', current_user)
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = :'test_database'
)\gexec
SQL
