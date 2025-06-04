-- public.customer_sale_view source

CREATE OR REPLACE VIEW public.customer_sale_view
AS SELECT s1.customer_id,
    c.name,
    c.mobile,
    s2.since,
    date_part('day'::text, now() - s2.since::timestamp with time zone) / 30::double precision AS since_months,
    s2.total AS tilldate_total,
    s1.bill_date AS recent_visit,
    s1.id AS recent_sale_id,
    s1.total AS recent_total,
    date_part('day'::text, now() - s1.bill_date::timestamp with time zone) AS since_recent_days,
    s1.expreturn_days AS expreturndays
   FROM sale s1
     JOIN ( SELECT sale.customer_id,
            min(sale.bill_date) AS since,
            max(sale.bill_date) AS latest,
            sum(sale.total) AS total
           FROM sale
          GROUP BY sale.customer_id) s2 ON s1.customer_id = s2.customer_id AND s1.bill_date = s2.latest
     JOIN customer c ON c.id = s1.customer_id
  ORDER BY s1.bill_date DESC;

  -- public.inventory_view source

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
          GROUP BY product_qtychange.item_id) pq ON pq.item_id = pii.id
     LEFT JOIN app_user au ON pii.verified_by = au.id
  ORDER BY p.title, pii.exp_date DESC;

  -- public.invoices_view source

CREATE OR REPLACE VIEW public.invoices_view
AS SELECT pi.id,
    pi.invoice_no,
    pi.invoice_date,
    v.business_name,
    pi.status,
    count(pii.id) AS items,
    round(sum(pii.qty::double precision * pii.ptr_cost * (1::double precision - COALESCE(pii.disc_pcnt, 0::double precision) / 100::double precision))) AS total
   FROM purchase_invoice pi
     JOIN vendor v ON v.id = pi.vendor_id
     LEFT JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
  GROUP BY pi.id, pi.invoice_no, pi.invoice_date, v.business_name, pi.status
  ORDER BY pi.invoice_date DESC;

  -- public.price_view source

CREATE OR REPLACE VIEW public.price_view
AS SELECT p.id,
    p.title,
    p.active,
    pi.mrp,
    pi.ptr,
    pr.price,
    pr.last_updated,
    round((COALESCE(pr.price::double precision, pi.mrp) - pi.ptr) / pi.ptr * 100::double precision) AS margin,
    round((pi.mrp - COALESCE(pr.price::double precision, pi.mrp)) / pi.mrp * 100::double precision) AS discount
   FROM product p
     JOIN ( SELECT pii.product_id,
            pii.mrp_cost AS mrp,
            pii.ptr_cost AS ptr
           FROM purchase_invoice_item pii
             JOIN purchase_invoice pi2 ON pi2.id = pii.invoice_id
             JOIN ( SELECT pii_1.product_id,
                    max(pi_1.invoice_date) AS last_date
                   FROM purchase_invoice_item pii_1
                     JOIN purchase_invoice pi_1 ON pi_1.id = pii_1.invoice_id
                  GROUP BY pii_1.product_id) x ON x.product_id = pii.product_id AND pi2.invoice_date = x.last_date) pi ON pi.product_id = p.id
     LEFT JOIN ( SELECT pp.product_id,
            pp.sale_price AS price,
            date(pp.updated_on) AS last_updated
           FROM product_price2 pp
          WHERE pp.end_date > CURRENT_DATE) pr ON pr.product_id = p.id
  WHERE pi.ptr > 0::double precision AND pi.mrp > 0::double precision
  ORDER BY pr.last_updated DESC;

  -- public.product_items_agg_view source

CREATE OR REPLACE VIEW public.product_items_agg_view
AS SELECT id,
    title,
    active,
    expired,
    max(invoice_date) AS last_purchase_date,
    date(max(last_sale_date)) AS last_sale_date,
    sum(purchased) AS purchased,
    sum(sold) AS sold,
    sum(adjusted) AS adjusted,
    sum(purchased) - sum(sold) + COALESCE(sum(adjusted), 0::numeric) AS balance
   FROM product_items_view vw
  WHERE expired = false
  GROUP BY id, title, active, expired
  ORDER BY title;

  -- public.product_items_view source

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
  GROUP BY p.id, p.title, pi.invoice_date, pi.invoice_no, pi.tax_pcnt, pi.mrp_cost, pi.id, pi.batch, pi.exp_date, pi.last_sale_date, pi.qty, pi.status, pi.sold
  ORDER BY p.title;

  -- public.product_sale_agg_view source

CREATE OR REPLACE VIEW public.product_sale_agg_view
AS SELECT product_id,
    avg(total_customers) AS average_customers,
    max(total_customers) AS highest_customers,
    avg(total_orders) AS average_orders,
    max(total_orders) AS highest_orders,
    avg(total_qty) AS average_sales,
    max(total_qty) AS highest_sales
   FROM product_sale_monthly_view vw
  WHERE sale_month >= (CURRENT_DATE - '6 mons'::interval)
  GROUP BY product_id
  ORDER BY product_id;

  -- public.product_sale_monthly_view source

CREATE OR REPLACE VIEW public.product_sale_monthly_view
AS SELECT si.product_id,
    date(date_trunc('month'::text, s.bill_date)) AS sale_month,
    count(DISTINCT s.customer_id) AS total_customers,
    count(s.bill_no) AS total_orders,
    sum(si.qty) AS total_qty,
    date(max(s.bill_date)) AS last_date
   FROM sale_item si
     JOIN sale s ON s.id = si.sale_id
  GROUP BY si.product_id, (date(date_trunc('month'::text, s.bill_date)))
  ORDER BY si.product_id, (date(date_trunc('month'::text, s.bill_date))) DESC;

  -- public.sale_customer_view source

CREATE OR REPLACE VIEW public.sale_customer_view
AS SELECT s1.customer_id,
    c.name,
    c.mobile,
    to_char(s2.since, 'yyyy-mm-dd'::text) AS since,
    date_part('day'::text, s1.bill_date - s2.since) AS age_on_visit,
        CASE
            WHEN date_part('day'::text, s1.bill_date - s2.since) = 0::double precision THEN 'NEW'::text
            ELSE 'RETURN'::text
        END AS return_status,
    date_part('day'::text, now() - s2.since::timestamp with time zone) / 30::double precision AS since_months,
    s2.total AS tilldate_total,
    to_char(s1.bill_date, 'yyyy-mm-dd'::text)::date AS recent_visit,
    s1.id AS recent_sale_id,
    s1.total AS recent_total,
    date_part('day'::text, now() - s1.bill_date::timestamp with time zone) / 7::double precision AS since_recent_weeks,
    s1.expreturn_days AS expreturndays
   FROM sale s1
     JOIN ( SELECT sale.customer_id,
            min(sale.bill_date) AS since,
            max(sale.bill_date) AS latest,
            sum(sale.total) AS total
           FROM sale
          GROUP BY sale.customer_id) s2 ON s1.customer_id = s2.customer_id
     JOIN customer c ON c.id = s1.customer_id
  ORDER BY s1.bill_date DESC;

  -- public.sale_view source

CREATE OR REPLACE VIEW public.sale_view
AS SELECT s.id,
    date(s.bill_date) AS sale_date,
    c.id AS customer_id,
    c.name AS customer_name,
    c.mobile AS customer_mobile,
    p.id AS product_id,
    p.title AS product,
    pii.batch,
    pii.exp_date,
    si.qty AS sale_qty,
    round((pii.ptr_value / p.pack::double precision * (1::double precision + pii.tax_pcnt / 100::double precision))::numeric, 2) AS ptr_cost,
    round((pii.ptr_value / p.pack::double precision * (1::double precision + pii.tax_pcnt / 100::double precision) * si.qty::double precision)::numeric, 2) AS purchase_total,
    si.price AS sale_price,
    si.total AS sale_total,
    round((si.total - pii.ptr_value / p.pack::double precision * si.qty::double precision)::numeric, 2) AS profit
   FROM sale_item si
     JOIN sale s ON s.id = si.sale_id
     JOIN customer c ON c.id = s.customer_id
     JOIN purchase_invoice_item pii ON pii.id = si.purchase_item_id
     JOIN product p ON p.id = pii.product_id;

-- public.stock_view source

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
          GROUP BY pc.item_id) y ON y.item_id = pii.id
  WHERE pii.status::text = 'VERIFIED'::text;

  -- public.vw_returns_gst_report source

CREATE OR REPLACE VIEW public.vw_returns_gst_report
AS SELECT s.bill_no,
    to_char(s.bill_date, 'yyyy-MM-dd'::text)::date AS bill_date,
    c.name,
    (sri.qty::double precision * si.price)::numeric AS sale_total,
    (si.tax_pcnt / 2::double precision)::numeric AS cgst_pcnt,
    round((sum(sri.qty::double precision * si.price) * (si.tax_pcnt / 2::double precision / 100::double precision))::numeric, 2) AS cgst_amt,
    (si.tax_pcnt / 2::double precision)::numeric AS sgst_pcnt,
    round((sum(sri.qty::double precision * si.price) * (si.tax_pcnt / 2::double precision / 100::double precision))::numeric, 2) AS sgst_amt,
    round((sum(sri.qty::double precision * si.price) * (si.tax_pcnt / 2::double precision / 100::double precision))::numeric, 2) + round((sum(sri.qty::double precision * si.price) * (si.tax_pcnt / 2::double precision / 100::double precision))::numeric, 2) AS gst_total
   FROM sale_item si
     JOIN sale s ON s.id = si.sale_id
     JOIN customer c ON c.id = s.customer_id
     JOIN sale_return_item sri ON sri.sale_item_id = si.id
  GROUP BY s.bill_no, s.bill_date, c.name, sri.qty, si.price, si.tax_pcnt;

  -- public.vw_sales_gst_report source

CREATE OR REPLACE VIEW public.vw_sales_gst_report
AS SELECT s.bill_no,
    to_char(s.bill_date, 'yyyy-MM-dd'::text)::date AS bill_date,
    c.name,
    sum(si.total)::numeric AS sale_total,
    COALESCE(si.tax_pcnt / 2::double precision, 0::double precision)::numeric AS cgst_pcnt,
    round((sum(si.total) * (si.tax_pcnt / 2::double precision / 100::double precision))::numeric, 2) AS cgst_amt,
    COALESCE(si.tax_pcnt / 2::double precision, 0::double precision)::numeric AS sgst_pcnt,
    round((sum(si.total) * (si.tax_pcnt / 2::double precision / 100::double precision))::numeric, 2) AS sgst_amt,
    round((sum(si.total) * (si.tax_pcnt / 2::double precision / 100::double precision))::numeric, 2) + round((sum(si.total) * (si.tax_pcnt / 2::double precision / 100::double precision))::numeric, 2) AS gst_total
   FROM sale_item si
     JOIN sale s ON s.id = si.sale_id
     JOIN customer c ON c.id = s.customer_id
  GROUP BY s.bill_no, s.bill_date, c.name, si.tax_pcnt
  ORDER BY s.bill_date, s.bill_no;