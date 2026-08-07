ALTER TABLE public.sale_deliveries
    DROP COLUMN IF EXISTS failure_reason,
    DROP COLUMN IF EXISTS collection_status,
    DROP COLUMN IF EXISTS payment_mode,
    DROP COLUMN IF EXISTS actual_cost,
    DROP COLUMN IF EXISTS confirmed_at,
    DROP COLUMN IF EXISTS confirmed_by,
    DROP COLUMN IF EXISTS confirmed,
    DROP COLUMN IF EXISTS delivered_at,
    DROP COLUMN IF EXISTS courier_partner,
    DROP COLUMN IF EXISTS delivery_method;
