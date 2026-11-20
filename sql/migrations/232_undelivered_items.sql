-- 232: items an order asked for that the vendor did not deliver. On the invoice the user decides, line by line, what becomes of the rest:
-- wait for it on this order, order it again (a new order, same or another vendor), add it to another open order, or keep it as a request.
--   purchase_request.not_delivered_qty       how much of this line was moved off the order as not delivered
--   purchase_request.moved_from_request_id   on the line created for the undelivered quantity: the order line it came from
--   purchase_request.moved_note              where it went / where it came from, in words
--   purchase_invoice.undelivered_checked_qty the undelivered quantity the user has decided on (waiting for it); the invoice cannot be completed while
--                                            the quantity not delivered differs from this
-- Rollback: 232_rollback.sql.
ALTER TABLE public.purchase_request ADD COLUMN IF NOT EXISTS not_delivered_qty int4 NOT NULL DEFAULT 0;
ALTER TABLE public.purchase_request ADD COLUMN IF NOT EXISTS moved_from_request_id int4 NULL;
ALTER TABLE public.purchase_request ADD COLUMN IF NOT EXISTS moved_note varchar(300) NULL;
ALTER TABLE public.purchase_invoice ADD COLUMN IF NOT EXISTS undelivered_checked_qty numeric NULL;
