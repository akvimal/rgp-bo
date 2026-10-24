-- 097: the server refuses a completed bill that charges more than the MRP (price + GST per unit above the batch's MRP per unit).
-- 'on' (default) refuses; 'off' lets it through, for a day when the price list has to be corrected before billing can continue.
INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES ('pricing', 'sale_mrp_guard', 'on', 'on: refuse a completed bill line that charges more than the MRP; off: allow it', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;
