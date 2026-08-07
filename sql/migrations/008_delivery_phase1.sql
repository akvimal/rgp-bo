ALTER TABLE public.sale_deliveries
    ADD COLUMN IF NOT EXISTS delivery_method varchar NULL,
    ADD COLUMN IF NOT EXISTS courier_partner varchar NULL,
    ADD COLUMN IF NOT EXISTS delivered_at timestamp NULL,
    ADD COLUMN IF NOT EXISTS confirmed bool DEFAULT false NULL,
    ADD COLUMN IF NOT EXISTS confirmed_by varchar NULL,
    ADD COLUMN IF NOT EXISTS confirmed_at timestamp NULL,
    ADD COLUMN IF NOT EXISTS actual_cost float4 NULL,
    ADD COLUMN IF NOT EXISTS payment_mode varchar NULL,
    ADD COLUMN IF NOT EXISTS collection_status varchar NULL,
    ADD COLUMN IF NOT EXISTS failure_reason varchar NULL;
