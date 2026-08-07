alter table public.purchase_order
    drop column if exists approval_status,
    drop column if exists approval_reason,
    drop column if exists approval_requested_by,
    drop column if exists approval_requested_at,
    drop column if exists approved_by,
    drop column if exists approved_at,
    drop column if exists rejected_by,
    drop column if exists rejected_at,
    drop column if exists rejection_reason;

drop table if exists public.app_setting;
