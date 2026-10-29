-- rollback of 107_gst_registration.sql (documents already issued are lost with the columns: use only before any invoice is issued)
DROP TABLE IF EXISTS public.gst_credit_note;
DROP FUNCTION IF EXISTS public.gst_next_no(int4, varchar, varchar);
DROP TABLE IF EXISTS public.gst_doc_counter;
DROP INDEX IF EXISTS public.sale_gst_invoice_uq;
ALTER TABLE public.sale DROP COLUMN IF EXISTS place_of_supply;
ALTER TABLE public.sale DROP COLUMN IF EXISTS buyer_gstin;
ALTER TABLE public.sale DROP COLUMN IF EXISTS gst_business_id;
ALTER TABLE public.sale DROP COLUMN IF EXISTS gst_invoice_no;
DROP TABLE IF EXISTS public.gst_registration;
