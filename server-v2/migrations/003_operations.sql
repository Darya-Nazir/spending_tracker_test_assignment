-- Up Migration

alter table categories
    add column is_default boolean not null default false;

create unique index categories_user_type_default_unique
    on categories (user_id, type)
    where is_default;

create table operations (
    id integer generated always as identity primary key,
    user_id integer not null references users (id) on delete cascade,
    category_id integer not null references categories (id),
    type category_type not null,
    amount numeric(14, 2) not null check (amount > 0),
    date date not null,
    comment text not null default ''
);

create index operations_user_date_desc_index
    on operations (user_id, date desc);

create index operations_category_id_index
    on operations (category_id);

-- Down Migration

drop table operations;

drop index categories_user_type_default_unique;

alter table categories
    drop column is_default;
