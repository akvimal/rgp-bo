-- 122: How a business prices, in the words an owner uses (see api-v2/src/modules/app/products/pricing-mode.ts).
--  * pricing_mode: MRP (every product sells at its MRP), DISCOUNT (a usual and a deepest discount off the MRP) or SMART (the nine class rules
--    with stepped raises, as the app has always worked). A business that already has prices or sales keeps SMART, so nothing changes under
--    it; a new business starts on MRP. The class rules stay and are edited under "Advanced".
--  * price_basis: prices are shown and typed with GST included ("what the customer pays") or before GST. Existing businesses keep before-GST;
--    a new one starts with GST included. Stored prices are always before GST: this only changes how they are shown and typed.
--  * mode_discount_pct / mode_max_discount_pct / mode_min_margin_pct: the numbers for DISCOUNT.
INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
SELECT 'pricing', 'pricing_mode',
       CASE WHEN EXISTS (SELECT 1 FROM public.product_price2) OR EXISTS (SELECT 1 FROM public.sale) THEN 'SMART' ELSE 'MRP' END,
       'How prices are set: MRP, DISCOUNT (off the MRP) or SMART (class rules)', true, false, 1, 1
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'pricing_mode');

INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
SELECT 'pricing', 'price_basis',
       CASE WHEN EXISTS (SELECT 1 FROM public.product_price2) OR EXISTS (SELECT 1 FROM public.sale) THEN 'excl' ELSE 'incl' END,
       'Prices are shown and typed with GST included (incl) or before GST (excl)', true, false, 1, 1
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'price_basis');

INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES
  ('pricing', 'mode_discount_pct', '10', 'DISCOUNT mode: the usual discount off the MRP for a first price', true, false, 1, 1),
  ('pricing', 'mode_max_discount_pct', '15', 'DISCOUNT mode: the deepest discount any price may have', true, false, 1, 1),
  ('pricing', 'mode_min_margin_pct', '0', 'DISCOUNT mode: the lowest markup on cost', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;
