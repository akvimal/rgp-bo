-- 106: GST rates that change on a date, and the HSN of products.
--  * gst_rate_change: a dated change of the GST billed on sales. It covers all products, a category, an HSN prefix or one product, and either sets the
--    rate or caps it. The most specific change in force on the bill date wins. Bills already made keep the rate on their lines.
--  * gst_sale_rate(product, batch GST, date): the GST the till bills for a product on a date. With no change in force it is the batch's own GST.
--  * sale_gst(batch GST) keeps its name for the callers that have no product: it applies only the "all products" changes in force today.
--    The global 5% cap of GST 2.0 (setting pricing/sale_gst_cap_pct) becomes one dated "all products" change from 22 Sep 2025.
--  * category_hsn_default: a default HSN for a category, shown as provisional until the Business Head confirms it.
--  * the gstfiling permission group (GST > Rate changes, HSN, registers) for the people who run the business.

CREATE TABLE IF NOT EXISTS public.gst_rate_change (
    id serial4 PRIMARY KEY,
    scope_type varchar(12) NOT NULL,
    scope_value varchar(60) NOT NULL DEFAULT '',
    mode varchar(3) NOT NULL,
    rate numeric(5,2) NOT NULL,
    effective_from date NOT NULL,
    price_policy varchar(12) NOT NULL DEFAULT 'pass_saving',
    note varchar(300) NULL,
    created_by int4 NULL,
    created_on timestamptz NOT NULL DEFAULT now(),
    cancelled_on timestamptz NULL,
    cancelled_by int4 NULL,
    CONSTRAINT gst_rate_change_scope_chk CHECK (scope_type IN ('all', 'category', 'hsn_prefix', 'product')),
    CONSTRAINT gst_rate_change_mode_chk CHECK (mode IN ('set', 'cap')),
    CONSTRAINT gst_rate_change_rate_chk CHECK (rate >= 0 AND rate <= 40),
    CONSTRAINT gst_rate_change_policy_chk CHECK (price_policy IN ('pass_saving', 'keep_price')),
    CONSTRAINT gst_rate_change_value_chk CHECK (scope_type = 'all' OR btrim(scope_value) <> '')
);
CREATE INDEX IF NOT EXISTS gst_rate_change_eff_idx ON public.gst_rate_change (effective_from) WHERE cancelled_on IS NULL;

CREATE TABLE IF NOT EXISTS public.category_hsn_default (
    id serial4 PRIMARY KEY,
    category varchar(100) NOT NULL,
    hsn varchar(8) NOT NULL,
    confirmed_by int4 NULL,
    confirmed_on timestamptz NULL,
    created_by int4 NULL,
    created_on timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS category_hsn_default_uq ON public.category_hsn_default (lower(category));

-- the GST 2.0 cap becomes a dated change (only when the setting still says so)
INSERT INTO public.gst_rate_change (scope_type, scope_value, mode, rate, effective_from, price_policy, note)
SELECT 'all', '', 'cap', btrim(s.setting_value)::numeric, DATE '2025-09-22', 'pass_saving', 'GST 2.0: no line is billed above this rate (from the old setting pricing/sale_gst_cap_pct)'
  FROM public.app_setting s
 WHERE s.setting_key = 'sale_gst_cap_pct' AND s.active AND NOT s.archive AND btrim(coalesce(s.setting_value, '')) ~ '^[0-9]+(\.[0-9]+)?$' AND btrim(s.setting_value)::numeric > 0
   AND NOT EXISTS (SELECT 1 FROM public.gst_rate_change);

-- one change applied to a batch's GST
CREATE OR REPLACE FUNCTION public.gst_apply_change(mode varchar, rate numeric, tax double precision) RETURNS double precision
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN mode = 'set' THEN rate::double precision ELSE LEAST(COALESCE(tax, 0), rate::double precision) END
$$;

-- the GST billed with no product known: only the "all products" changes count (the latest one in force today)
CREATE OR REPLACE FUNCTION public.sale_gst(tax double precision) RETURNS double precision
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT public.gst_apply_change(c.mode, c.rate, tax) FROM public.gst_rate_change c
      WHERE c.cancelled_on IS NULL AND c.scope_type = 'all' AND c.effective_from <= current_date
      ORDER BY c.effective_from DESC, c.id DESC LIMIT 1),
    COALESCE(tax, 0))
$$;

-- the GST billed for a product on a date: product, then HSN prefix (longest), then category, then all products; the latest of equal specificity
CREATE OR REPLACE FUNCTION public.gst_sale_rate(p_product int4, p_batch_tax double precision, p_on date DEFAULT current_date) RETURNS double precision
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT public.gst_apply_change(c.mode, c.rate, p_batch_tax)
       FROM public.gst_rate_change c, public.product p
      WHERE p.id = p_product AND c.cancelled_on IS NULL AND c.effective_from <= p_on
        AND (c.scope_type = 'all'
          OR (c.scope_type = 'product' AND c.scope_value = p_product::text)
          OR (c.scope_type = 'category' AND lower(btrim(c.scope_value)) = lower(btrim(coalesce(p.category, ''))))
          OR (c.scope_type = 'hsn_prefix' AND coalesce(nullif(btrim(p.hsn_code), ''),
                (SELECT d.hsn FROM public.category_hsn_default d WHERE lower(d.category) = lower(btrim(coalesce(p.category, ''))) LIMIT 1), '#') LIKE btrim(c.scope_value) || '%'))
      ORDER BY CASE c.scope_type WHEN 'product' THEN 4 WHEN 'hsn_prefix' THEN 3 WHEN 'category' THEN 2 ELSE 1 END DESC,
               CASE WHEN c.scope_type = 'hsn_prefix' THEN length(btrim(c.scope_value)) ELSE 0 END DESC,
               c.effective_from DESC, c.id DESC
      LIMIT 1),
    COALESCE(p_batch_tax, 0))
$$;

-- price_view: the GST billed now, for the product
CREATE OR REPLACE VIEW public.price_view AS
 SELECT p.id,
    p.title,
    p.active,
    pi.mrp,
    pi.ptr,
    pi.tax,
    pr.price,
    pr.last_updated,
    round((((COALESCE((pr.price)::double precision, pi.mrp / (1 + public.gst_sale_rate(p.id, pi.tax::double precision) / 100)) * (1 + COALESCE(pi.tax, 0) / 100) - pi.ptr) / pi.ptr) * (100)::double precision)) AS margin,
    round((((pi.mrp - COALESCE((pr.price)::double precision, pi.mrp / (1 + public.gst_sale_rate(p.id, pi.tax::double precision) / 100)) * (1 + public.gst_sale_rate(p.id, pi.tax::double precision) / 100)) / pi.mrp) * (100)::double precision)) AS discount,
    public.gst_sale_rate(p.id, pi.tax::double precision)::real AS sale_tax
   FROM ((product p
     JOIN ( SELECT pii.product_id,
            pii.mrp_cost AS mrp,
            pii.ptr_cost AS ptr,
            pii.tax_pcnt AS tax
           FROM ((purchase_invoice_item pii
             JOIN purchase_invoice pi2 ON ((pi2.id = pii.invoice_id)))
             JOIN ( SELECT pii_1.product_id,
                    max(pi_1.invoice_date) AS last_date
                   FROM (purchase_invoice_item pii_1
                     JOIN purchase_invoice pi_1 ON ((pi_1.id = pii_1.invoice_id)))
                  GROUP BY pii_1.product_id) x ON (((x.product_id = pii.product_id) AND (pi2.invoice_date = x.last_date))))) pi ON ((pi.product_id = p.id)))
     LEFT JOIN ( SELECT pp.product_id,
            pp.sale_price AS price,
            date(pp.updated_on) AS last_updated
           FROM product_price2 pp
          WHERE (pp.end_date > CURRENT_DATE)) pr ON ((pr.product_id = p.id)))
  WHERE ((pi.ptr > (0)::double precision) AND (pi.mrp > (0)::double precision))
  ORDER BY pr.last_updated DESC;

-- the people who run the business may use GST (rate changes, HSN, registers); the counter does not
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"gstfiling","path":"/secure/gst-filing","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "gstfiling")');
