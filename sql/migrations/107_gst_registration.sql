-- 107: GST registration and the documents a registered business issues.
--  * gst_registration: whether the business is on GST ('registered') or not ('none'), the date from which it issues tax invoices, the invoice prefix and the
--    turnover limit shown to a business that is not registered. The GSTIN and state stay on the business.
--  * sale: the tax invoice number (a financial-year series, no gaps), the buyer's GSTIN and the place of supply (decides CGST+SGST or IGST).
--  * gst_doc_counter and gst_next_no(): the numbers, taken inside the bill's own transaction so a bill that fails leaves no gap.
--  * gst_credit_note: one per settled return of a tax invoice, at the invoice's own rate.

CREATE TABLE IF NOT EXISTS public.gst_registration (
    business_id int4 PRIMARY KEY REFERENCES public.business(id),
    reg_type varchar(12) NOT NULL DEFAULT 'none',
    go_live date NULL,
    invoice_prefix varchar(4) NOT NULL DEFAULT 'INV',
    turnover_limit numeric(14,2) NOT NULL DEFAULT 4000000,
    updated_by int4 NULL,
    updated_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT gst_registration_type_chk CHECK (reg_type IN ('none', 'registered')),
    CONSTRAINT gst_registration_prefix_chk CHECK (invoice_prefix ~ '^[A-Z0-9]{2,3}$'),
    CONSTRAINT gst_registration_live_chk CHECK (reg_type = 'none' OR go_live IS NOT NULL)
);

-- the prefix is 2 or 3 characters so the number (prefix/26-27/000123) stays within the 16 characters a tax invoice allows
ALTER TABLE public.gst_registration DROP CONSTRAINT IF EXISTS gst_registration_prefix_chk;
ALTER TABLE public.gst_registration ADD CONSTRAINT gst_registration_prefix_chk CHECK (invoice_prefix ~ '^[A-Z0-9]{2,3}$');

-- a business that already has a valid GSTIN is taken as registered from today; every other business is not registered
INSERT INTO public.gst_registration (business_id, reg_type, go_live)
SELECT b.id,
       CASE WHEN b.gstin IS NOT NULL AND btrim(b.gstin) <> '' AND public.is_valid_gstin(b.gstin) THEN 'registered' ELSE 'none' END,
       CASE WHEN b.gstin IS NOT NULL AND btrim(b.gstin) <> '' AND public.is_valid_gstin(b.gstin) THEN current_date ELSE NULL END
  FROM public.business b
ON CONFLICT (business_id) DO NOTHING;

ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS gst_invoice_no varchar(20) NULL;
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS gst_business_id int4 NULL;
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS buyer_gstin varchar(15) NULL;
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS place_of_supply varchar(2) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sale_gst_invoice_uq ON public.sale (gst_business_id, gst_invoice_no) WHERE gst_invoice_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gst_doc_counter (
    business_id int4 NOT NULL,
    doc_type varchar(4) NOT NULL,
    fy varchar(5) NOT NULL,
    last_no int4 NOT NULL DEFAULT 0,
    PRIMARY KEY (business_id, doc_type, fy)
);

-- the next number of a document series for a financial year ('25-26'); the first call creates the series
CREATE OR REPLACE FUNCTION public.gst_next_no(p_business int4, p_doc varchar, p_fy varchar) RETURNS int4
LANGUAGE sql AS $$
  INSERT INTO public.gst_doc_counter (business_id, doc_type, fy, last_no) VALUES (p_business, p_doc, p_fy, 1)
  ON CONFLICT (business_id, doc_type, fy) DO UPDATE SET last_no = public.gst_doc_counter.last_no + 1
  RETURNING last_no
$$;

CREATE TABLE IF NOT EXISTS public.gst_credit_note (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL,
    note_no varchar(20) NOT NULL,
    note_date date NOT NULL,
    sale_id int4 NOT NULL,
    sale_item_id int4 NOT NULL,
    return_item_id int4 NOT NULL,
    original_invoice_no varchar(20) NOT NULL,
    original_invoice_date date NOT NULL,
    rate numeric(5,2) NOT NULL,
    qty int4 NOT NULL,
    gross numeric(12,2) NOT NULL,
    taxable numeric(12,2) NOT NULL,
    tax numeric(12,2) NOT NULL,
    place_of_supply varchar(2) NULL,
    buyer_gstin varchar(15) NULL,
    created_by int4 NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT gst_credit_note_return_uq UNIQUE (return_item_id),
    CONSTRAINT gst_credit_note_no_uq UNIQUE (business_id, note_no)
);
CREATE INDEX IF NOT EXISTS gst_credit_note_date_idx ON public.gst_credit_note (business_id, note_date);
