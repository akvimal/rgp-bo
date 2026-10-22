DELETE FROM public.app_setting WHERE category = 'sales' AND setting_key = 'supply_expiry_buffer_months';
ALTER TABLE public.sale_item DROP CONSTRAINT IF EXISTS sale_item_supply_months_chk;
ALTER TABLE public.sale_item DROP COLUMN IF EXISTS supply_months;
