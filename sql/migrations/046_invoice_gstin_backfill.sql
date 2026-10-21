-- 046_invoice_gstin_backfill.sql
-- GST reconciliation matches an invoice against the portal by the supplier's GSTIN, and skips invoices that
-- have none. Most history was entered before vendors carried a GSTIN, so this fills the supplier GSTIN on a
-- vendor's invoices from the vendor record: used when a vendor's GSTIN is saved or loaded, and at cutover.
--   * only blanks are filled, and only from a valid GSTIN;
--   * an invoice in a locked GST period is never touched;
--   * it returns how many invoices were updated, and running it again changes nothing.
CREATE OR REPLACE FUNCTION public.backfill_vendor_invoice_gstin(p_vendor int) RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
  g text;
  n int;
BEGIN
  SELECT upper(btrim(gstn)) INTO g FROM public.vendor WHERE id = p_vendor;
  IF g IS NULL OR g = '' OR NOT public.is_valid_gstin(g) THEN RETURN 0; END IF;
  UPDATE public.purchase_invoice i
     SET supplier_gstin = g, updated_on = now()
   WHERE i.vendor_id = p_vendor
     AND coalesce(btrim(i.supplier_gstin), '') = ''
     AND NOT EXISTS (SELECT 1 FROM public.gst_return_period rp WHERE rp.period = i.gst_period AND rp.status = 'LOCKED');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
