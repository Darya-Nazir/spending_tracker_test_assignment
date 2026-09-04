-- Up Migration

update users
set email = lower(email)
where email <> lower(email);

create unique index users_email_unique on users (email);

-- Down Migration

drop index users_email_unique;
