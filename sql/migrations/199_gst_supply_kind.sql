-- 199: nil-rated, exempt or non-GST (docs/planning/GST_SALES_REPORT.md)
-- A supply billed at 0% is one of three kinds for the return. The CA says which once, per category (the default kept here), and a product can
-- override it. It matters only for a line billed at 0%; with nothing set a 0% line is nil-rated. Additive and re-runnable.

CREATE TABLE IF NOT EXISTS public.gst_supply_kind_default (
    id serial4 PRIMARY KEY,
    category varchar(100) NOT NULL,
    kind varchar(12) NOT NULL CHECK (kind IN ('NIL_RATED', 'EXEMPT', 'NON_GST')),
    confirmed_by int4 NULL,
    confirmed_on timestamptz NULL,
    created_by int4 NULL,
    created_on timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS gst_supply_kind_default_uq ON public.gst_supply_kind_default (lower(category));

ALTER TABLE public.product ADD COLUMN IF NOT EXISTS gst_supply_kind varchar(12) NULL;
ALTER TABLE public.product DROP CONSTRAINT IF EXISTS product_gst_supply_kind_chk;
ALTER TABLE public.product ADD CONSTRAINT product_gst_supply_kind_chk CHECK (gst_supply_kind IS NULL OR gst_supply_kind IN ('NIL_RATED', 'EXEMPT', 'NON_GST'));
