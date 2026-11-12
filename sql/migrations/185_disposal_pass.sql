-- 185: expiry management. (1) A vendor says whether it takes back expired or near-expiry goods, and within how many days of the expiry. (2) The out-pass: a numbered
-- document for goods that leave the shop as waste (expired, near expiry, damaged): DRAFT -> APPROVED (the quantity is held: still on the books, no longer saleable) ->
-- CONFIRMED (handed over or destroyed: the stock drops, one adjustment per line, linked to the pass). (3) The disposal register for Schedule H, H1 and X lines of a
-- confirmed pass, numbered per business and schedule. Safe to run twice.

ALTER TABLE public.vendor ADD COLUMN IF NOT EXISTS takes_back varchar(12) NOT NULL DEFAULT 'NONE';
ALTER TABLE public.vendor ADD COLUMN IF NOT EXISTS takeback_days int4;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendor_takes_back_chk') THEN
    ALTER TABLE public.vendor ADD CONSTRAINT vendor_takes_back_chk CHECK (takes_back IN ('NONE', 'NEAR_EXPIRY', 'EXPIRED', 'BOTH'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.disposal_pass (
  id             serial PRIMARY KEY,
  business_id    int4 NOT NULL REFERENCES public.business(id),
  store_id       int4 NOT NULL REFERENCES public.stores(id),
  pass_year      int4 NOT NULL,
  seq            int4 NOT NULL,
  pass_no        varchar(20) NOT NULL,                       -- OP-2026-0007: per business, restarts each year
  status         varchar(10) NOT NULL DEFAULT 'DRAFT',
  reason         varchar(12) NOT NULL,                       -- EXPIRED, NEAR_EXPIRY, DAMAGED
  method         varchar(10) NOT NULL,                       -- DESTROYED, AGENCY, VENDOR, OTHER
  agency         varchar(120),                               -- the disposal agency or carrier
  notes          varchar(300),
  evidence_path  varchar(300),                               -- a photo or the agency's receipt (optional)
  prepared_by    int4 NOT NULL REFERENCES public.app_user(id),
  prepared_on    timestamptz NOT NULL DEFAULT now(),
  approved_by    int4 REFERENCES public.app_user(id),
  approved_on    timestamptz,
  decision_note  varchar(200),
  confirmed_by   int4 REFERENCES public.app_user(id),
  confirmed_on   timestamptz,
  handed_on      date,                                       -- the day the goods left or were destroyed
  witness_id     int4 REFERENCES public.app_user(id),        -- a second staff member, for Schedule H / H1 / X lines confirmed by someone who is not a manager
  legacy         boolean NOT NULL DEFAULT false,             -- "disposed earlier, recorded now"
  created_on     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT disposal_pass_status_chk CHECK (status IN ('DRAFT', 'APPROVED', 'CONFIRMED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT disposal_pass_reason_chk CHECK (reason IN ('EXPIRED', 'NEAR_EXPIRY', 'DAMAGED')),
  CONSTRAINT disposal_pass_method_chk CHECK (method IN ('DESTROYED', 'AGENCY', 'VENDOR', 'OTHER')),
  CONSTRAINT disposal_pass_no_uq UNIQUE (business_id, pass_no)
);
CREATE INDEX IF NOT EXISTS disposal_pass_store_idx ON public.disposal_pass (store_id, status);

CREATE TABLE IF NOT EXISTS public.disposal_pass_line (
  id            serial PRIMARY KEY,
  pass_id       int4 NOT NULL REFERENCES public.disposal_pass(id) ON DELETE CASCADE,
  item_id       int4 NOT NULL REFERENCES public.purchase_invoice_item(id),
  product_id    int4 NOT NULL,
  title         varchar(200) NOT NULL,
  batch         varchar(60),
  exp_date      date,
  schedule      varchar(3),                                  -- H, H1 or X when the product is a scheduled drug
  qty           int4 NOT NULL CHECK (qty > 0),               -- units
  cost_value    numeric(12,2) NOT NULL DEFAULT 0,            -- at cost, before GST
  tax_value     numeric(12,2) NOT NULL DEFAULT 0,            -- the GST paid on that cost (what an input credit reversal would look at)
  mrp_value     numeric(12,2) NOT NULL DEFAULT 0,
  qtychange_id  int4,                                        -- the stock adjustment posted when the pass was confirmed
  CONSTRAINT disposal_pass_line_uq UNIQUE (pass_id, item_id)
);
CREATE INDEX IF NOT EXISTS disposal_pass_line_item_idx ON public.disposal_pass_line (item_id);

ALTER TABLE public.product_qtychange ADD COLUMN IF NOT EXISTS disposal_pass_id int4 REFERENCES public.disposal_pass(id);
CREATE INDEX IF NOT EXISTS product_qtychange_pass_idx ON public.product_qtychange (disposal_pass_id) WHERE disposal_pass_id IS NOT NULL;

-- the disposal register of scheduled drugs: one line per Schedule H, H1 or X line of a confirmed pass, numbered per business and schedule (its own series)
CREATE TABLE IF NOT EXISTS public.schedule_disposal_register (
  id            serial PRIMARY KEY,
  business_id   int4 NOT NULL REFERENCES public.business(id),
  store_id      int4 REFERENCES public.stores(id),
  schedule      varchar(3) NOT NULL,
  serial_no     int4 NOT NULL,
  pass_id       int4 NOT NULL REFERENCES public.disposal_pass(id),
  pass_line_id  int4 NOT NULL REFERENCES public.disposal_pass_line(id),
  entry_on      timestamptz NOT NULL DEFAULT now(),
  handed_on     date,
  drug_name     varchar(200) NOT NULL,
  batch         varchar(60),
  exp_date      date,
  qty           int4 NOT NULL,
  reason        varchar(12) NOT NULL,
  method        varchar(10) NOT NULL,
  agency        varchar(120),
  confirmed_by  int4 REFERENCES public.app_user(id),
  witness_id    int4 REFERENCES public.app_user(id),
  created_on    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_disposal_schedule_chk CHECK (schedule IN ('H', 'H1', 'X')),
  CONSTRAINT schedule_disposal_serial_uq UNIQUE (business_id, schedule, serial_no),
  CONSTRAINT schedule_disposal_line_uq UNIQUE (pass_line_id)
);
