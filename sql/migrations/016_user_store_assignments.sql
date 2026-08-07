create table if not exists public.user_stores (
    id serial4 primary key,
    user_id int4 not null,
    store_id int4 not null,
    is_primary bool default false not null,
    created_on timestamptz default current_timestamp not null,
    updated_on timestamptz default current_timestamp not null,
    created_by int4 null,
    updated_by int4 null,
    archive bool default false not null,
    active bool default true not null,
    constraint user_stores_user_fk foreign key (user_id) references public.app_user(id),
    constraint user_stores_store_fk foreign key (store_id) references public.stores(id)
);

create unique index if not exists idx_user_stores_user_store on public.user_stores(user_id, store_id);
create index if not exists idx_user_stores_user on public.user_stores(user_id);
create index if not exists idx_user_stores_store on public.user_stores(store_id);
