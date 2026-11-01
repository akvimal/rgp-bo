-- 138: receiving, a line in dispute (price or anything else the vendor must clarify), the tax rates a business buys at, and an MRP-far-above-rate flag.
--
-- A draft invoice line can be moved to DISPUTED with a note: it leaves the invoice total (and the GST split) and cannot be completed over; the user clarifies with
-- the vendor, then ACCEPTS it (back to NEW, to be verified) or REJECTS it (status REJECTED: total set to 0, the original kept in rejected_total).
ALTER TABLE public.purchase_invoice_item
  ADD COLUMN IF NOT EXISTS dispute_note varchar(300),
  ADD COLUMN IF NOT EXISTS dispute_by integer,
  ADD COLUMN IF NOT EXISTS dispute_on timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_result varchar(10),
  ADD COLUMN IF NOT EXISTS dispute_result_note varchar(300),
  ADD COLUMN IF NOT EXISTS dispute_result_by integer,
  ADD COLUMN IF NOT EXISTS dispute_result_on timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_total numeric(12,2);

-- the tax rates offered on a purchase line (a list such as 0,5,18); empty = the default of the business type (pharmacy 0,5,18; others 0,5,12,18,28)
INSERT INTO public.app_setting (category, setting_key, setting_value, description)
SELECT 'purchases', 'purchase_tax_rates', '', 'Tax % choices offered on a purchase invoice line, as a list such as 0,5,18. Empty = the usual rates for this type of business.'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'purchase_tax_rates');

-- an MRP (without GST) this many times the net rate is flagged on the receiving screen
INSERT INTO public.app_setting (category, setting_key, setting_value, description)
SELECT 'purchases', 'mrp_rate_flag_ratio', '6', 'A purchase line whose MRP (without GST) is this many times its net rate is flagged: check the printed MRP, so an inflated MRP is not shown to customers as a discount.'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'mrp_rate_flag_ratio');
