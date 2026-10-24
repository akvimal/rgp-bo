-- 094: price_view compared a price WITHOUT GST with the MRP and purchase cost WITH GST, so the discount looked smaller and the
-- margin lower than they are, and a price at the MRP looked legal when the bill (price + GST) charged more than the MRP.
-- discount = how far the GST-inclusive price is below the MRP; margin = markup of the price over the cost, both with GST
-- (the same figure as without GST on both sides). Same columns as before.
CREATE OR REPLACE VIEW public.price_view AS
 SELECT p.id,
    p.title,
    p.active,
    pi.mrp,
    pi.ptr,
    pi.tax,
    pr.price,
    pr.last_updated,
    round((((COALESCE((pr.price)::double precision, pi.mrp / (1 + COALESCE(pi.tax, 0) / 100)) * (1 + COALESCE(pi.tax, 0) / 100) - pi.ptr) / pi.ptr) * (100)::double precision)) AS margin,
    round((((pi.mrp - COALESCE((pr.price)::double precision, pi.mrp / (1 + COALESCE(pi.tax, 0) / 100)) * (1 + COALESCE(pi.tax, 0) / 100)) / pi.mrp) * (100)::double precision)) AS discount
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
