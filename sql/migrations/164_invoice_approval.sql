-- 164: approval for payment of a purchase invoice. "Complete" says the goods and the bill agree; approval says finance may pay it.
--   purchase_invoice.approved_by / approved_on / approval_note   who cleared it for payment, when, and an optional note
--   app_setting purchasing / invoice_approval ('on' | 'off', default off) and invoice_approval_limit (invoices up to this amount need no approval; 0 = every invoice needs it)
-- A business that has not switched it on sees no change.
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS approved_by int4 NULL;
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS approved_on timestamptz NULL;
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS approval_note varchar(200) NULL;

INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES
  ('purchasing', 'invoice_approval', 'off', 'Purchase invoices must be approved for payment before they can be paid (on / off)', true, false, 1, 1),
  ('purchasing', 'invoice_approval_limit', '0', 'Invoices up to this amount need no approval for payment (0 = every invoice needs approval)', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;
