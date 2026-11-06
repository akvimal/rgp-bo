-- 163: goods sent back to a vendor, tracked on their own until the vendor credits them on a later purchase invoice.
--   vendor_return / vendor_return_item   what went back (batch, qty, credit rate); stock falls when it is made (a product_qtychange VENDOR_RETURN)
--   purchase_invoice_credit              a return adjusted on an invoice: the invoice total = what was bought less these credits
CREATE TABLE IF NOT EXISTS public.vendor_return (
  id                  serial PRIMARY KEY,
  vendor_id           int4 NOT NULL REFERENCES public.vendor(id),
  store_id            int4 NOT NULL,
  return_no           varchar(30),
  return_date         date NOT NULL DEFAULT current_date,
  reason              varchar(200),
  status              varchar(12) NOT NULL DEFAULT 'OPEN',
  total               numeric(12,2) NOT NULL DEFAULT 0,
  adjusted_invoice_id int4,
  adjusted_on         timestamptz,
  cancel_note         varchar(200),
  active              bool NOT NULL DEFAULT true,
  archive             bool NOT NULL DEFAULT false,
  created_on          timestamptz NOT NULL DEFAULT now(),
  updated_on          timestamptz NOT NULL DEFAULT now(),
  created_by          int4,
  updated_by          int4,
  CONSTRAINT vendor_return_status_chk CHECK (status IN ('OPEN', 'ADJUSTED', 'CANCELLED'))
);
CREATE INDEX IF NOT EXISTS vendor_return_vendor_idx ON public.vendor_return (vendor_id, status);

CREATE TABLE IF NOT EXISTS public.vendor_return_item (
  id            serial PRIMARY KEY,
  return_id     int4 NOT NULL REFERENCES public.vendor_return(id),
  item_id       int4 NOT NULL REFERENCES public.purchase_invoice_item(id),
  product_id    int4 NOT NULL,
  batch         varchar,
  qty           int4 NOT NULL CHECK (qty > 0),
  rate          numeric(12,4) NOT NULL DEFAULT 0,
  tax_pcnt      numeric(6,2) NOT NULL DEFAULT 0,
  total         numeric(12,2) NOT NULL DEFAULT 0,
  qtychange_id  int4,
  active        bool NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS vendor_return_item_return_idx ON public.vendor_return_item (return_id);

CREATE TABLE IF NOT EXISTS public.purchase_invoice_credit (
  id          serial PRIMARY KEY,
  invoice_id  int4 NOT NULL REFERENCES public.purchase_invoice(id),
  return_id   int4 NOT NULL REFERENCES public.vendor_return(id),
  taxable     numeric(12,2) NOT NULL DEFAULT 0,
  tax         numeric(12,2) NOT NULL DEFAULT 0,
  amount      numeric(12,2) NOT NULL,
  active      bool NOT NULL DEFAULT true,
  created_on  timestamptz NOT NULL DEFAULT now(),
  created_by  int4,
  CONSTRAINT purchase_invoice_credit_amt_chk CHECK (amount > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_invoice_credit_return_uq ON public.purchase_invoice_credit (return_id) WHERE active;
CREATE INDEX IF NOT EXISTS purchase_invoice_credit_inv_idx ON public.purchase_invoice_credit (invoice_id) WHERE active;
