-- Up Migration

create table sessions (
    id integer generated always as identity primary key,
    user_id integer not null references users (id) on delete cascade,
    token_hash char(64) not null unique,
    expires_at timestamptz not null,
    device text not null,
    revoked_at timestamptz,
    replaced_by integer references sessions (id) on delete set null
);

create index sessions_user_id_index
    on sessions (user_id);

-- Down Migration

drop table sessions;
