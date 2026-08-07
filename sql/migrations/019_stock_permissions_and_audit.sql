CREATE OR REPLACE VIEW public.inventory_view
AS SELECT pii.id,
    p.id AS product_id,
    pii.invoice_id AS purchase_invoiceid,
    pi.invoice_no,
    pi.invoice_date,
    pii.id AS purchase_itemid,
    p.title AS product_title,
    p.pack AS product_pack,
    p.product_code,
    p.more_props,
    pii.batch AS product_batch,
    pii.exp_date AS product_expdate,
    pii.tax_pcnt AS product_taxpcnt,
    pii.mrp_cost AS mrp,
    pii.qty * p.pack AS purchased,
    pii.status,
    pii.verify_start_date,
    pii.verify_end_date,
    pii.verified_by AS verified_userid,
    au.full_name AS verified_username,
    pii.active,
    COALESCE(si.bal, 0::bigint) AS sold,
    COALESCE(pq.bal, 0::bigint) AS adjusted,
    pii.qty * p.pack - COALESCE(si.bal, 0::bigint) + COALESCE(pq.bal, 0::bigint) AS available
   FROM product p
     JOIN purchase_invoice_item pii ON p.id = pii.product_id
     JOIN purchase_invoice pi ON pi.id = pii.invoice_id
     LEFT JOIN ( SELECT si_1.purchase_item_id,
            sum(si_1.qty) AS bal
           FROM sale_item si_1
          WHERE si_1.status::text = 'Complete'::text
          GROUP BY si_1.purchase_item_id) si ON si.purchase_item_id = pii.id
     LEFT JOIN ( SELECT product_qtychange.item_id,
            sum(product_qtychange.qty) AS bal
           FROM product_qtychange
          WHERE coalesce(product_qtychange.status, 'APPROVED') = 'APPROVED'
          GROUP BY product_qtychange.item_id) pq ON pq.item_id = pii.id
     LEFT JOIN app_user au ON pii.verified_by = au.id
  ORDER BY p.title, pii.exp_date DESC;

CREATE OR REPLACE VIEW public.product_items_view
AS SELECT p.id,
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
            WHEN pi.exp_date < (CURRENT_DATE + 30) THEN true
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
     LEFT JOIN product_qtychange pq ON pq.item_id = pi.id
      AND coalesce(pq.status, 'APPROVED') = 'APPROVED'
  GROUP BY p.id, p.title, pi.invoice_date, pi.invoice_no, pi.tax_pcnt, pi.mrp_cost, pi.id, pi.batch, pi.exp_date, pi.last_sale_date, pi.qty, pi.status, pi.sold
  ORDER BY p.title;

CREATE OR REPLACE VIEW public.stock_view
AS SELECT pii.id,
    pi.invoice_no,
    pi.invoice_date,
    pii.invoice_id,
    p.id AS product_id,
    p.title,
    p.more_props,
    p.pack,
    pii.batch,
    pii.exp_date AS expdate,
    pii.mrp_cost,
    pii.ptr_value,
    round(pii.sale_price::numeric, 2) AS sale_price,
    pii.ptr_cost,
    pii.tax_pcnt,
    (pii.qty + (+ COALESCE(pii.free_qty, 0))) * p.pack AS sale_qty,
    pii.qty + COALESCE(pii.free_qty, 0) AS purchase_qty,
    (pii.qty + (+ COALESCE(pii.free_qty, 0))) * p.pack - COALESCE(x.total_qty, 0::bigint) - COALESCE(y.adj_qty, 0::bigint) AS available_qty,
    (date_part('year'::text, now()) - date_part('year'::text, pi.invoice_date)) * 12::double precision + (date_part('month'::text, now()) - date_part('month'::text, pi.invoice_date)) AS old_with_us,
    (date_part('year'::text, pii.exp_date) - date_part('year'::text, now())) * 12::double precision + (date_part('month'::text, pii.exp_date) - date_part('month'::text, now())) AS life_left
   FROM purchase_invoice_item pii
     JOIN purchase_invoice pi ON pi.id = pii.invoice_id
     JOIN product p ON p.id = pii.product_id
     LEFT JOIN ( SELECT si.purchase_item_id,
            sum(si.qty) AS total_qty
           FROM sale_item si
             JOIN sale s ON s.id = si.sale_id
          WHERE s.status::text = 'COMPLETE'::text AND (si.status::text = 'Sale Complete'::text OR si.status::text = 'Return Accepted'::text)
          GROUP BY si.purchase_item_id) x ON x.purchase_item_id = pii.id
     LEFT JOIN ( SELECT pc.item_id,
            sum(pc.qty) AS adj_qty
           FROM product_qtychange pc
          WHERE coalesce(pc.status, 'APPROVED') = 'APPROVED'
          GROUP BY pc.item_id) y ON y.item_id = pii.id
  WHERE pii.status::text = 'VERIFIED'::text;
