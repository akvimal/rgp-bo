-- 231: items added to a purchase order after it was submitted. Each addition is kept on the order as a short record (when, who, why, which items), and the
-- order goes back to "Awaiting approval" until it is approved again.
--   amendments  [{ at, by, byname, comment, items: [{ requestid, title, qty }] }], oldest first
-- Rollback: 231_rollback.sql.
ALTER TABLE public.purchase_order ADD COLUMN IF NOT EXISTS amendments jsonb NOT NULL DEFAULT '[]'::jsonb;
