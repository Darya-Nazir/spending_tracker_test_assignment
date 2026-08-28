-- Up Migration

create table users (
    id integer generated always as identity primary key,
    email text not null,
    name text not null,
    password_hash text not null,
    initial_balance numeric(14, 2) not null default 0,
    created_at timestamptz not null default current_timestamp
);

create unique index users_email_lower_unique on users (lower(email));

-- Down Migration

drop table users;
