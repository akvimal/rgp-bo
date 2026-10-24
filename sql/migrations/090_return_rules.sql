-- 090: what may be returned and how a return is settled.
--  * product.return_rule: this product alone is NONE (not accepted back), INSPECT (checked before it is taken back) or FREE.
--    Blank follows the category's rule (return_category_rule), and no rule means FREE. Refrigerated lines are the usual NONE.
--  * stores.cash_refund_limit: the most a store refunds in cash on one return. Blank: no limit. 0: never cash, store credit instead.
--  * sale_return_item records the inspection and what was taken back or discarded; stock moves in the same transaction as the refund.
--  * product_qtychange.discarded flags stock that left the shelf as waste (expired, damaged, discarded on return).
ALTER TABLE public.product ADD COLUMN IF NOT EXISTS return_rule varchar(8) NULL;
ALTER TABLE public.product DROP CONSTRAINT IF EXISTS product_return_rule_chk;
ALTER TABLE public.product ADD CONSTRAINT product_return_rule_chk CHECK (return_rule IS NULL OR return_rule IN ('FREE', 'INSPECT', 'NONE'));

CREATE TABLE IF NOT EXISTS public.return_category_rule (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL,
    category varchar(100) NOT NULL,
    rule varchar(8) NOT NULL,
    CONSTRAINT return_category_rule_chk CHECK (rule IN ('FREE', 'INSPECT', 'NONE')),
    CONSTRAINT return_category_rule_uq UNIQUE (business_id, category)
);

ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS cash_refund_limit numeric(12,2) NULL;

ALTER TABLE public.sale_return_item ADD COLUMN IF NOT EXISTS needs_inspection boolean NOT NULL DEFAULT false;
ALTER TABLE public.sale_return_item ADD COLUMN IF NOT EXISTS inspected_by int4 NULL;
ALTER TABLE public.sale_return_item ADD COLUMN IF NOT EXISTS inspected_on timestamptz NULL;
ALTER TABLE public.sale_return_item ADD COLUMN IF NOT EXISTS inspection_note varchar(500) NULL;
ALTER TABLE public.sale_return_item ADD COLUMN IF NOT EXISTS accepted_qty int4 NULL;
ALTER TABLE public.sale_return_item ADD COLUMN IF NOT EXISTS discarded_qty int4 NULL;
ALTER TABLE public.sale_return_item ADD COLUMN IF NOT EXISTS settled_by int4 NULL;
ALTER TABLE public.sale_return_item ADD COLUMN IF NOT EXISTS settled_on timestamptz NULL;

ALTER TABLE public.product_qtychange ADD COLUMN IF NOT EXISTS discarded boolean NOT NULL DEFAULT false;
UPDATE public.product_qtychange SET discarded = true WHERE qty < 0 AND upper(coalesce(reason_code, reason, '')) IN ('EXPIRED', 'DAMAGED', 'BREAKAGE') AND discarded = false;
