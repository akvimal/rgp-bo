-- 151: an expiry date means the whole month. Batches carry it as the 1st of the month (11/2026 is stored 2026-11-01) and are good until the
-- last day of it, so "30 days before expiry" is measured from the last day of the month, not the 1st (which hid a batch from the start of its expiry
-- month, and the next month's from a month early). public.expiry_end(date) is the one place that says so.
CREATE OR REPLACE FUNCTION public.expiry_end(d date) RETURNS date
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT (date_trunc('month', d) + interval '1 month - 1 day')::date $$;

CREATE OR REPLACE VIEW public.product_items_view AS
 SELECT p.id,
    p.title,
    p.pack,
    p.active,
    pi.invoice_date,
    pi.invoice_no,
    pi.id AS item_id,
    pi.batch,
    pi.exp_date,
    pi.status,
    pi.tax_pcnt,
    pi.mrp_cost,
    pi.last_sale_date,
        CASE
            WHEN public.expiry_end(pi.exp_date) < (CURRENT_DATE + 30) THEN true
            ELSE false
        END AS expired,
    pi.qty * COALESCE(p.pack, 1) AS purchased,
    COALESCE(pi.sold, 0::bigint) AS sold,
    COALESCE(sum(pq.qty), 0::bigint) AS adjusted,
    pi.qty * COALESCE(p.pack, 1) - COALESCE(pi.sold, 0::bigint) + COALESCE(sum(pq.qty), 0::bigint) AS balance
   FROM product p
     LEFT JOIN ( SELECT i.invoice_date,
            i.invoice_no,
            pii.id,
            pii.product_id,
            pii.batch,
            pii.exp_date,
            pii.qty + COALESCE(pii.free_qty::bigint, 0::bigint) AS qty,
            pii.tax_pcnt,
            pii.mrp_cost,
            pii.status,
            COALESCE(sum(si.qty), 0::bigint) AS sold,
            max(s.bill_date) AS last_sale_date
           FROM purchase_invoice_item pii
             JOIN purchase_invoice i ON i.id = pii.invoice_id
             LEFT JOIN sale_item si ON si.purchase_item_id = pii.id
             LEFT JOIN sale s ON s.id = si.sale_id
          GROUP BY i.invoice_date, i.invoice_no, pii.id, pii.tax_pcnt, pii.mrp_cost, pii.product_id, pii.batch, pii.exp_date, pii.qty, pii.status) pi ON pi.product_id = p.id
     LEFT JOIN product_qtychange pq ON pq.item_id = pi.id AND COALESCE(pq.status, 'APPROVED'::character varying)::text = 'APPROVED'::text
  GROUP BY p.id, p.title, pi.invoice_date, pi.invoice_no, pi.tax_pcnt, pi.mrp_cost, pi.id, pi.batch, pi.exp_date, pi.last_sale_date, pi.qty, pi.status, pi.sold
  ORDER BY p.title;
