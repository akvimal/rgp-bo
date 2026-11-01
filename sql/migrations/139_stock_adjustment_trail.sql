-- 139: a stock adjustment keeps the event it belongs to and how it was settled.
--   audit_id    : the stock audit a count difference (or an adjustment made for an audit) belongs to
--   settle_note : why it was approved or rejected; settled_by / settled_on: who and when
-- Count differences found before this migration are linked to their audit from the count.
ALTER TABLE public.product_qtychange
  ADD COLUMN IF NOT EXISTS audit_id integer,
  ADD COLUMN IF NOT EXISTS settle_note varchar(300),
  ADD COLUMN IF NOT EXISTS settled_by integer,
  ADD COLUMN IF NOT EXISTS settled_on timestamptz;

UPDATE public.product_qtychange q
   SET audit_id = a.id
  FROM public.stock_audit a
 WHERE q.count_id IS NOT NULL AND a.count_id = q.count_id AND q.audit_id IS NULL;

CREATE INDEX IF NOT EXISTS product_qtychange_audit_idx ON public.product_qtychange (audit_id) WHERE audit_id IS NOT NULL;
