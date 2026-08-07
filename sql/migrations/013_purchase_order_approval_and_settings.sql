create table if not exists public.app_setting (
    id serial4 primary key,
    category varchar(80) null,
    setting_key varchar(120) not null unique,
    setting_value varchar(400) null,
    description varchar(400) null,
    active bool default true not null,
    archive bool default false not null,
    created_on timestamptz default current_timestamp not null,
    updated_on timestamptz default current_timestamp not null,
    created_by int4 null,
    updated_by int4 null
);

alter table public.purchase_order
    add column if not exists approval_status varchar null,
    add column if not exists approval_reason varchar(400) null,
    add column if not exists approval_requested_by int4 null,
    add column if not exists approval_requested_at timestamptz null,
    add column if not exists approved_by int4 null,
    add column if not exists approved_at timestamptz null,
    add column if not exists rejected_by int4 null,
    add column if not exists rejected_at timestamptz null,
    add column if not exists rejection_reason varchar(400) null;

update public.purchase_order
set approval_status = coalesce(approval_status, 'Not Required')
where true;

update public.app_role
set permissions = replace(
    permissions::text,
    '},{"resource":"reports"',
    '},{"resource":"purchaseorders","path":["/secure/purchases/orders"],"policies":[{"action":"approve"},{"action":"reject"}]},{"resource":"reports"'
)::json
where id in (1, 3);

insert into public.app_setting
    (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
values
    ('purchases', 'purchase_order_approval_value_threshold', '5000', 'Approval required above this estimated PO value', true, false, 1, 1)
on conflict (setting_key) do nothing;
