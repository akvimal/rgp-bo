-- 157: a scanned purchase invoice can be saved as a draft and checked line by line over time.
-- The lines read from the invoice copy are kept with the draft (purchase_invoice_scan_line). Checking a line against the copy (which is already
-- corrected for the goods that came) makes it a VERIFIED invoice item at once; a line that is not on the invoice is discarded with a reason.
-- A draft needs only a vendor and a store: the invoice or challan number is required before the invoice is completed, not before it is saved.
CREATE TABLE IF NOT EXISTS public.purchase_invoice_scan_line (
    id bigserial PRIMARY KEY,
    invoice_id int4 NOT NULL REFERENCES public.purchase_invoice(id) ON DELETE CASCADE,
    position int4 NOT NULL,
    description text NULL,                       -- the words the invoice copy had for the product
    product_id int4 NULL REFERENCES public.product(id),
    suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
    batch varchar(60) NULL,
    exp_ym char(7) NULL,                         -- YYYY-MM; the item keeps the 1st of the month
    mrp numeric(12,2) NULL,
    qty numeric(12,2) NULL,
    free_qty numeric(12,2) NOT NULL DEFAULT 0,
    rate numeric(12,4) NULL,
    disc_pcnt numeric(5,2) NOT NULL DEFAULT 0,
    tax_pcnt numeric(5,2) NULL,
    hsn varchar(20) NULL,
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
    state varchar(10) NOT NULL DEFAULT 'OPEN',   -- OPEN (still to check) | VERIFIED (an invoice item now) | DISCARDED (not on the invoice)
    item_id int4 NULL,
    verified_by int4 NULL REFERENCES public.app_user(id),
    verified_on timestamptz NULL,
    discard_reason varchar(200) NULL,
    updated_by int4 NULL REFERENCES public.app_user(id),
    updated_on timestamptz NOT NULL DEFAULT now(),
    created_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT purchase_invoice_scan_line_state_chk CHECK (state IN ('OPEN', 'VERIFIED', 'DISCARDED'))
);
CREATE INDEX IF NOT EXISTS purchase_invoice_scan_line_invoice_idx ON public.purchase_invoice_scan_line (invoice_id, position);
CREATE INDEX IF NOT EXISTS purchase_invoice_scan_line_open_idx ON public.purchase_invoice_scan_line (invoice_id) WHERE state = 'OPEN';

-- what the reading found besides the lines (method, cash discount factor), so a resumed draft shows the same checks
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS scan_meta jsonb NULL;

-- a draft (NEW) may have no invoice or challan number yet; any other invoice must have one
ALTER TABLE public.purchase_invoice DROP CONSTRAINT IF EXISTS purchase_invoice_ref_chk;
ALTER TABLE public.purchase_invoice ADD CONSTRAINT purchase_invoice_ref_chk CHECK (status = 'NEW' OR invoice_no IS NOT NULL OR challan_no IS NOT NULL);
