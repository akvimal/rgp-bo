-- 063_sale_supply_months.sql
-- A sale line can say how many months of medicine the customer is buying. The till then checks that the batch will still
-- be in date after that many months plus a safety margin (setting sales / supply_expiry_buffer_months, default 3), so a
-- 6-month supply needs a batch good for 9 months. Whether a counter user may sell through a short-dated batch is the
-- Store Head's / Business Head's call; every override is audited.

ALTER TABLE public.sale_item ADD COLUMN IF NOT EXISTS supply_months numeric(4,1);
ALTER TABLE public.sale_item DROP CONSTRAINT IF EXISTS sale_item_supply_months_chk;
ALTER TABLE public.sale_item ADD CONSTRAINT sale_item_supply_months_chk CHECK (supply_months IS NULL OR (supply_months > 0 AND supply_months <= 24));

INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive)
SELECT 'sales', 'supply_expiry_buffer_months', '3', 'Months of shelf life a batch must have beyond the supply the customer is buying', true, false
WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE category = 'sales' AND setting_key = 'supply_expiry_buffer_months');
