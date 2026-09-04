-- Up Migration

alter table categories
    add column title_normalized text;

update categories
set title_normalized = lower(title);

create unique index categories_user_type_title_normalized_unique
    on categories (user_id, type, title_normalized)
    where title_normalized is not null;


-- Down Migration

drop index categories_user_type_title_normalized_unique;

alter table categories
    drop column title_normalized;
