-- rollback of 106_gst_rate_changes.sql: the till is back to the batch's GST capped by the setting pricing/sale_gst_cap_pct
CREATE OR REPLACE FUNCTION public.sale_gst(tax double precision) RETURNS double precision
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN c.cap IS NULL OR c.cap <= 0 THEN COALESCE(tax, 0) ELSE LEAST(COALESCE(tax, 0), c.cap) END
    FROM (SELECT (SELECT NULLIF(btrim(setting_value), '')::double precision FROM public.app_setting
                   WHERE setting_key = 'sale_gst_cap_pct' AND active AND NOT archive LIMIT 1) AS cap) c
$$;
CREATE OR REPLACE VIEW public.price_view AS
 SELECT p.id, p.title, p.active, pi.mrp, pi.ptr, pi.tax, pr.price, pr.last_updated,
    round((((COALESCE((pr.price)::double precision, pi.mrp / (1 + public.sale_gst(pi.tax::double precision) / 100)) * (1 + COALESCE(pi.tax, 0) / 100) - pi.ptr) / pi.ptr) * (100)::double precision)) AS margin,
    round((((pi.mrp - COALESCE((pr.price)::double precision, pi.mrp / (1 + public.sale_gst(pi.tax::double precision) / 100)) * (1 + public.sale_gst(pi.tax::double precision) / 100)) / pi.mrp) * (100)::double precision)) AS discount,
    public.sale_gst(pi.tax::double precision)::real AS sale_tax
   FROM ((product p
     JOIN ( SELECT pii.product_id, pii.mrp_cost AS mrp, pii.ptr_cost AS ptr, pii.tax_pcnt AS tax
           FROM ((purchase_invoice_item pii
             JOIN purchase_invoice pi2 ON ((pi2.id = pii.invoice_id)))
             JOIN ( SELECT pii_1.product_id, max(pi_1.invoice_date) AS last_date
                   FROM (purchase_invoice_item pii_1 JOIN purchase_invoice pi_1 ON ((pi_1.id = pii_1.invoice_id)))
                  GROUP BY pii_1.product_id) x ON (((x.product_id = pii.product_id) AND (pi2.invoice_date = x.last_date))))) pi ON ((pi.product_id = p.id)))
     LEFT JOIN ( SELECT pp.product_id, pp.sale_price AS price, date(pp.updated_on) AS last_updated FROM product_price2 pp WHERE (pp.end_date > CURRENT_DATE)) pr ON ((pr.product_id = p.id)))
  WHERE ((pi.ptr > (0)::double precision) AND (pi.mrp > (0)::double precision))
  ORDER BY pr.last_updated DESC;
DROP FUNCTION IF EXISTS public.gst_sale_rate(int4, double precision, date);
DROP FUNCTION IF EXISTS public.gst_apply_change(varchar, numeric, double precision);
DROP TABLE IF EXISTS public.category_hsn_default;
DROP TABLE IF EXISTS public.gst_rate_change;
UPDATE public.app_role SET permissions = (SELECT coalesce(json_agg(e), '[]'::json) FROM json_array_elements(permissions) e WHERE e->>'resource' <> 'gstfiling')
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "gstfiling")');
