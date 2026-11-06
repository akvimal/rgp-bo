-- 162: the price in force today is the one that has started (eff_date <= today) and not ended (end_date > today), one per product.
-- price_view took every row that had not ended, so a price starting later, or two prices on one day, gave a product two lines.
-- Same columns as before.
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
     LEFT JOIN ( SELECT DISTINCT ON (pp.product_id) pp.product_id,
            pp.sale_price AS price,
            date(pp.updated_on) AS last_updated
           FROM product_price2 pp
          WHERE pp.eff_date <= CURRENT_DATE AND pp.end_date > CURRENT_DATE AND pp.active AND NOT pp.archive
          ORDER BY pp.product_id, pp.eff_date DESC, pp.id DESC) pr ON ((pr.product_id = p.id)))
  WHERE ((pi.ptr > (0)::double precision) AND (pi.mrp > (0)::double precision))
  ORDER BY pr.last_updated DESC;

-- Repair: a product left with more than one open price (a second change on the same day left both open). The newest stays open;
-- an older open price is closed on the day the newest started (it was never billed after that). Skipped for a row where that
-- would repeat an existing row's key.
UPDATE public.product_price2 o
   SET end_date = n.eff_date
  FROM (SELECT DISTINCT ON (product_id) id, product_id, eff_date FROM public.product_price2
         WHERE end_date = '2099-12-31' AND active AND NOT archive ORDER BY product_id, eff_date DESC, id DESC) n
 WHERE o.product_id = n.product_id AND o.end_date = '2099-12-31' AND o.active AND NOT o.archive
   AND o.id <> n.id AND o.eff_date <= n.eff_date
   AND NOT EXISTS (SELECT 1 FROM public.product_price2 z WHERE z.product_id = o.product_id AND z.eff_date = o.eff_date AND z.sale_price = o.sale_price AND z.end_date = n.eff_date);
