create table if not exists public.stores (
    id serial4 primary key,
    location varchar(40) not null,
    business_id int4 not null,
    constraint stores_business_fk foreign key (business_id) references public.business(id)
);

create table if not exists public.store_cash_accounts (
    id serial4 primary key,
    trans_date date not null,
    category varchar(40) not null,
    description varchar not null,
    deposit float8 not null,
    withdraw float8 not null,
    store_id int4 not null,
    shift_id int4 null,
    constraint store_cash_accounts_store_fk foreign key (store_id) references public.stores(id)
);

create table if not exists public.store_shift_templates (
    id serial4 primary key,
    store_id int4 not null,
    name varchar(60) not null,
    start_time varchar(10) not null,
    end_time varchar(10) not null,
    deposit_threshold float8 default 0 not null,
    assigned_user_id int4 null,
    active bool default true not null,
    created_on timestamptz default current_timestamp not null,
    updated_on timestamptz default current_timestamp not null,
    created_by int4 null,
    updated_by int4 null,
    archive bool default false not null,
    constraint store_shift_templates_store_fk foreign key (store_id) references public.stores(id),
    constraint store_shift_templates_user_fk foreign key (assigned_user_id) references public.app_user(id)
);

create table if not exists public.store_shifts (
    id serial4 primary key,
    store_id int4 not null,
    template_id int4 null,
    shift_date date not null,
    name varchar(60) not null,
    start_time varchar(10) not null,
    end_time varchar(10) not null,
    status varchar(20) default 'OPEN' not null,
    opening_cash float8 default 0 not null,
    expected_cash float8 default 0 not null,
    counted_cash float8 null,
    variance float8 null,
    deposit_threshold float8 default 0 not null,
    assigned_user_id int4 null,
    opened_on timestamp null,
    closed_on timestamp null,
    notes varchar null,
    opened_by int4 null,
    closed_by int4 null,
    created_on timestamptz default current_timestamp not null,
    updated_on timestamptz default current_timestamp not null,
    created_by int4 null,
    updated_by int4 null,
    archive bool default false not null,
    constraint store_shifts_store_fk foreign key (store_id) references public.stores(id),
    constraint store_shifts_template_fk foreign key (template_id) references public.store_shift_templates(id),
    constraint store_shifts_user_fk foreign key (assigned_user_id) references public.app_user(id),
    constraint store_shifts_opened_by_fk foreign key (opened_by) references public.app_user(id),
    constraint store_shifts_closed_by_fk foreign key (closed_by) references public.app_user(id)
);

alter table public.store_shift_templates
    add column if not exists assigned_user_id int4 null;

alter table public.store_shifts
    add column if not exists assigned_user_id int4 null;

alter table public.store_cash_accounts
    add column if not exists shift_id int4 null;

alter table public.sale
    add column if not exists shift_id int4 null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'store_cash_accounts_shift_fk'
    ) then
        alter table public.store_cash_accounts
            add constraint store_cash_accounts_shift_fk foreign key (shift_id) references public.store_shifts(id);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'sale_shift_fk'
    ) then
        alter table public.sale
            add constraint sale_shift_fk foreign key (shift_id) references public.store_shifts(id);
    end if;
end$$;

create index if not exists idx_store_shift_templates_store on public.store_shift_templates(store_id);
create index if not exists idx_store_shifts_store_date on public.store_shifts(store_id, shift_date desc);
create index if not exists idx_store_shifts_status on public.store_shifts(status);
create index if not exists idx_store_cash_accounts_shift on public.store_cash_accounts(shift_id);
create index if not exists idx_sale_shift on public.sale(shift_id);
