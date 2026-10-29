-- 113: monthly targets (DASHBOARD_AND_MENU_DESIGN 6.5, implementation plan stage 6).
--  * metric_target: a value for a metric in a month, for the whole business (store_id null) or one store. Only 'sales' is read so far.
--    The Business Head sets it; tiles and the store health score read it. A month with no target simply has none (the score then ignores that check).
CREATE TABLE IF NOT EXISTS public.metric_target (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL,
    store_id int4 NULL,
    metric varchar(30) NOT NULL,
    month date NOT NULL,
    value numeric(14,2) NOT NULL,
    set_by int4 NULL,
    set_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT metric_target_month_chk CHECK (month = date_trunc('month', month)::date),
    CONSTRAINT metric_target_value_chk CHECK (value >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS metric_target_uq ON public.metric_target (business_id, coalesce(store_id, 0), metric, month);
