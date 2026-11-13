-- 191: a comment on a bill, for staff only. It is never printed on the bill or sent to the customer (the bill print and the WhatsApp copy are built from
-- chosen columns, and this is not one of them). A bill left to pay later must carry one: who agreed it, why, what was promised. Additive and re-runnable.
ALTER TABLE public.sale ADD COLUMN IF NOT EXISTS staff_comments varchar(500) NULL;
