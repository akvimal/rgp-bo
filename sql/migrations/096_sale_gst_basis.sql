-- 096: one place for "the GST the till bills".
-- Since GST 2.0 (22 Sep 2025) the till bills at most 5% GST on every line, whatever GST the purchase batch carries (older batches say 12%
-- or 18%). A price ceiling (the most a customer may be charged is the MRP, GST included) and a discount off MRP must use the GST that is
-- billed, not the batch's. app_setting pricing/sale_gst_cap_pct is that cap (blank or 0 = no cap, bill at the batch's rate).
-- price_view gains sale_tax (GST billed); its tax column stays the purchase batch's GST, which the cost side needs.
INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES ('pricing', 'sale_gst_cap_pct', '5', 'The till bills at most this GST percent on a line (GST 2.0); blank or 0 means no cap', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sale_gst(tax double precision) RETURNS double precision
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN c.cap IS NULL OR c.cap <= 0 THEN COALESCE(tax, 0) ELSE LEAST(COALESCE(tax, 0), c.cap) END
    FROM (SELECT (SELECT NULLIF(btrim(setting_value), '')::double precision FROM public.app_setting
                   WHERE setting_key = 'sale_gst_cap_pct' AND active AND NOT archive LIMIT 1) AS cap) c
$$;

-- discount: the price with the GST billed, against the MRP. margin: the price with the batch's GST against the cost with the batch's GST
-- (the same figure as price over cost, both without GST).
CREATE OR REPLACE VIEW public.price_view AS
 SELECT p.id,
    p.title,
    p.active,
    pi.mrp,
    pi.ptr,
    pi.tax,
    pr.price,
    pr.last_updated,
    round((((COALESCE((pr.price)::double precision, pi.mrp / (1 + public.sale_gst(pi.tax::double precision) / 100)) * (1 + COALESCE(pi.tax, 0) / 100) - pi.ptr) / pi.ptr) * (100)::double precision)) AS margin,
    round((((pi.mrp - COALESCE((pr.price)::double precision, pi.mrp / (1 + public.sale_gst(pi.tax::double precision) / 100)) * (1 + public.sale_gst(pi.tax::double precision) / 100)) / pi.mrp) * (100)::double precision)) AS discount,
    public.sale_gst(pi.tax::double precision)::real AS sale_tax
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
