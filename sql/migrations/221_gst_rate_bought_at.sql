-- 221: a GST rate change can cover "products bought at X%" (scope 'bought_at', e.g. 12): every batch whose purchase invoice charged that GST is billed at the
-- new rate from the date, whatever the product, category or HSN. It sits between "all products" and "a category" in specificity (a product, an HSN prefix or a
-- category set on its own still beats it). The till asks gst_sale_rate(product, batch GST, date); the batch GST it passes is the one the match is made on.
-- Rollback: 221_rollback.sql.
ALTER TABLE public.gst_rate_change DROP CONSTRAINT IF EXISTS gst_rate_change_scope_chk;
ALTER TABLE public.gst_rate_change ADD CONSTRAINT gst_rate_change_scope_chk CHECK (scope_type IN ('all', 'category', 'hsn_prefix', 'product', 'bought_at'));

CREATE OR REPLACE FUNCTION public.gst_sale_rate(p_product int4, p_batch_tax double precision, p_on date DEFAULT CURRENT_DATE) RETURNS double precision
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT public.gst_apply_change(c.mode, c.rate, p_batch_tax)
       FROM public.gst_rate_change c, public.product p
      WHERE p.id = p_product AND c.cancelled_on IS NULL AND c.effective_from <= p_on
        AND (c.scope_type = 'all'
          OR (c.scope_type = 'product' AND c.scope_value = p_product::text)
          OR (c.scope_type = 'category' AND lower(btrim(c.scope_value)) = lower(btrim(coalesce(p.category, ''))))
          OR (c.scope_type = 'hsn_prefix' AND coalesce(nullif(btrim(p.hsn_code), ''),
                (SELECT d.hsn FROM public.category_hsn_default d WHERE lower(d.category) = lower(btrim(coalesce(p.category, ''))) LIMIT 1), '#') LIKE btrim(c.scope_value) || '%')
          OR (c.scope_type = 'bought_at' AND abs(coalesce(p_batch_tax, 0) - (CASE WHEN c.scope_value ~ '^[0-9]+(\.[0-9]+)?$' THEN c.scope_value::numeric END)::double precision) < 0.005))
      ORDER BY CASE c.scope_type WHEN 'product' THEN 5 WHEN 'hsn_prefix' THEN 4 WHEN 'category' THEN 3 WHEN 'bought_at' THEN 2 ELSE 1 END DESC,
               CASE WHEN c.scope_type = 'hsn_prefix' THEN length(btrim(c.scope_value)) ELSE 0 END DESC,
               c.effective_from DESC, c.id DESC
      LIMIT 1),
    COALESCE(p_batch_tax, 0))
$$;
