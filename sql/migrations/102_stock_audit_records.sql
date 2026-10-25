-- 102_stock_audit_records.sql
-- Stock audits with a paper trail. A count now keeps every line it was given (matched lines too) with the book quantity taken when it started, so a
-- count sheet, a variance report and a signed certificate can be printed again, identically, later. Each audit has a number within its business
-- (SA-0012), a plan can cover the fast movers, scheduled drugs or expiring batches, and a large difference must be counted a second time by another person.

-- every line of a count, with the book quantity as at the start
CREATE TABLE IF NOT EXISTS public.stock_count_line (
  id          serial PRIMARY KEY,
  count_id    int4 NOT NULL REFERENCES public.stock_count(id),
  item_id     int4 NOT NULL REFERENCES public.purchase_invoice_item(id),
  product_id  int4,
  title       varchar(200),
  batch       varchar(60),
  exp_date    date,
  pack        int4,
  schedule    varchar(10),
  book_qty    int4 NOT NULL,
  counted_qty int4,
  unit_cost   numeric(12,4),
  sold_since  int4 NOT NULL DEFAULT 0,
  recount_qty int4,
  moved_other int4 NOT NULL DEFAULT 0,   -- approved adjustments, returns and transfers between the start and the end of counting
  expected_qty int4,                       -- book at the start, less sold, plus the other movements, as at the end of counting
  CONSTRAINT stock_count_line_uq UNIQUE (count_id, item_id)
);

ALTER TABLE public.stock_count_line ADD COLUMN IF NOT EXISTS recount_qty int4;
ALTER TABLE public.stock_count_line ADD COLUMN IF NOT EXISTS moved_other int4 NOT NULL DEFAULT 0;
ALTER TABLE public.stock_count_line ADD COLUMN IF NOT EXISTS expected_qty int4;
-- when the counting was finished: movements up to this moment are taken into account
ALTER TABLE public.stock_count ADD COLUMN IF NOT EXISTS finished_at timestamptz;

-- what the adjustment was raised from, and the second count of a large difference
ALTER TABLE public.product_qtychange
  ADD COLUMN IF NOT EXISTS book_qty    int4,
  ADD COLUMN IF NOT EXISTS counted_qty int4,
  ADD COLUMN IF NOT EXISTS recount_qty int4,
  ADD COLUMN IF NOT EXISTS recount_by  int4 REFERENCES public.app_user(id),
  ADD COLUMN IF NOT EXISTS recount_on  timestamptz;

-- audit number per business, what the audit covers, and the sign-off
ALTER TABLE public.stock_audit
  ADD COLUMN IF NOT EXISTS business_id  int4 REFERENCES public.business(id),
  ADD COLUMN IF NOT EXISTS audit_no     int4,
  ADD COLUMN IF NOT EXISTS scope        varchar(8),
  ADD COLUMN IF NOT EXISTS certified_on timestamptz,
  ADD COLUMN IF NOT EXISTS certified_by int4 REFERENCES public.app_user(id),
  ADD COLUMN IF NOT EXISTS certified_note varchar(300);

UPDATE public.stock_audit a SET business_id = s.business_id FROM public.stores s WHERE s.id = a.store_id AND a.business_id IS NULL;
UPDATE public.stock_audit a SET scope = coalesce(p.scope, CASE WHEN a.category IS NULL THEN 'ALL' ELSE 'CATEGORY' END)
  FROM (SELECT a2.id, pl.scope FROM public.stock_audit a2 LEFT JOIN public.stock_audit_plan pl ON pl.id = a2.plan_id) p WHERE p.id = a.id AND a.scope IS NULL;
UPDATE public.stock_audit a SET audit_no = n.rn
  FROM (SELECT id, row_number() OVER (PARTITION BY business_id ORDER BY id) AS rn FROM public.stock_audit) n WHERE n.id = a.id AND a.audit_no IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stock_audit_no_uq ON public.stock_audit (business_id, audit_no);

-- a plan may cover the fast movers, the scheduled drugs, or the batches expired or about to
ALTER TABLE public.stock_audit_plan DROP CONSTRAINT IF EXISTS stock_audit_plan_scope_chk;
ALTER TABLE public.stock_audit_plan ADD CONSTRAINT stock_audit_plan_scope_chk CHECK (scope IN ('ALL', 'CATEGORY', 'ROTATE', 'FAST', 'SCHEDULE', 'EXPIRY'));
ALTER TABLE public.stock_audit_plan ALTER COLUMN scope TYPE varchar(8);

-- the signed certificate is kept as it was printed
CREATE TABLE IF NOT EXISTS public.stock_audit_document (
  id         serial PRIMARY KEY,
  audit_id   int4 NOT NULL REFERENCES public.stock_audit(id),
  kind       varchar(12) NOT NULL,
  filename   varchar(80) NOT NULL,
  content    bytea NOT NULL,
  created_by int4 NOT NULL REFERENCES public.app_user(id),
  created_on timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_audit_document_uq UNIQUE (audit_id, kind)
);
