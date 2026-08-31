-- Up Migration

create type category_type as enum ('income', 'expense');

create table categories (
    id integer generated always as identity primary key,
    user_id integer not null references users (id) on delete cascade,
    type category_type not null,
    title text not null
);

create unique index categories_user_type_title_lower_unique
    on categories (user_id, type, lower(title));

-- Down Migration

drop table categories;
drop type category_type;
