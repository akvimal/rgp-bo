-- Rollback of 221: the "bought at X%" changes are removed (the constraint no longer allows them) and the till's function is the one from migration 106.
DELETE FROM public.gst_rate_change WHERE scope_type = 'bought_at';
ALTER TABLE public.gst_rate_change DROP CONSTRAINT IF EXISTS gst_rate_change_scope_chk;
ALTER TABLE public.gst_rate_change ADD CONSTRAINT gst_rate_change_scope_chk CHECK (scope_type IN ('all', 'category', 'hsn_prefix', 'product'));

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
                (SELECT d.hsn FROM public.category_hsn_default d WHERE lower(d.category) = lower(btrim(coalesce(p.category, ''))) LIMIT 1), '#') LIKE btrim(c.scope_value) || '%'))
      ORDER BY CASE c.scope_type WHEN 'product' THEN 4 WHEN 'hsn_prefix' THEN 3 WHEN 'category' THEN 2 ELSE 1 END DESC,
               CASE WHEN c.scope_type = 'hsn_prefix' THEN length(btrim(c.scope_value)) ELSE 0 END DESC,
               c.effective_from DESC, c.id DESC
      LIMIT 1),
    COALESCE(p_batch_tax, 0))
$$;
