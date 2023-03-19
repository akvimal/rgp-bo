-- public.invoices_view source

CREATE OR REPLACE VIEW public.invoices_view
AS SELECT pi.id,
    pi.invoice_no,
    pi.invoice_date,
    v.business_name,
    pi.status,
    count(pii.id) AS items,
    round(sum(pii.total::double precision * (1::double precision + pii.tax_pcnt / 100::double precision))) AS total
   FROM purchase_invoice pi
     JOIN vendor v ON v.id = pi.vendor_id
     LEFT JOIN purchase_invoice_item pii ON pii.invoice_id = pi.id
  GROUP BY pi.id, pi.invoice_no, pi.invoice_date, v.business_name, pi.status
  ORDER BY pi.invoice_date DESC;

-- public.stock_view source

CREATE OR REPLACE VIEW public.stock_view
AS SELECT pii.id,
    pi.invoice_no,
    pi.invoice_date,
    pii.invoice_id,
    p.title,
    p.more_props,
    p.pack,
    pii.batch,
    pii.exp_date AS expdate,
    pii.mrp_cost,
    pii.ptr_value,
    round(pii.ptr_value::numeric * (1::numeric + pii.tax_pcnt::numeric / 100::numeric), 2) AS ptr_cost,
    round(pii.sale_price::numeric, 2) AS sale_price,
    pii.tax_pcnt,
    pii.qty * p.pack AS sale_qty,
    pii.qty AS purchase_qty,
    pii.qty * p.pack - COALESCE(x.total_qty, 0::bigint) AS available_qty,
    (date_part('year'::text, now()) - date_part('year'::text, pi.invoice_date)) * 12::double precision + (date_part('month'::text, now()) - date_part('month'::text, pi.invoice_date)) AS old_with_us,
    (date_part('year'::text, pii.exp_date) - date_part('year'::text, now())) * 12::double precision + (date_part('month'::text, pii.exp_date) - date_part('month'::text, now())) AS life_left
   FROM purchase_invoice_item pii
     JOIN purchase_invoice pi ON pi.id = pii.invoice_id
     JOIN product p ON p.id = pii.product_id
     LEFT JOIN ( SELECT si.purchase_item_id,
            sum(si.qty) AS total_qty
           FROM sale_item si
             JOIN sale s ON s.id = si.sale_id
          WHERE s.status::text = 'COMPLETE'::text
          GROUP BY si.purchase_item_id) x ON x.purchase_item_id = pii.id
  WHERE pii.status::text = 'VERIFIED'::text AND (pi.status::text = ANY (ARRAY['RECEIVED'::text, 'PAID'::text]));

-- public.sale_view source

CREATE OR REPLACE VIEW public.sale_view
AS SELECT s.id,
    date(s.bill_date) AS sale_date,
    c.name AS customer_name,
    c.mobile AS customer_mobile,
    p.title AS product,
    pii.batch,
    pii.exp_date,
    si.qty AS sale_qty,
    round((pii.ptr_value / p.pack::double precision * (1::double precision + pii.tax_pcnt / 100::double precision))::numeric, 2) AS ptr_cost,
    round((pii.ptr_value / p.pack::double precision * (1::double precision + pii.tax_pcnt / 100::double precision) * si.qty::double precision)::numeric, 2) AS purchase_total,
    si.price AS sale_price,
    si.total AS sale_total,
    round((si.total::double precision - pii.ptr_value / p.pack::double precision * si.qty::double precision)::numeric, 2) AS profit
   FROM sale_item si
     JOIN sale s ON s.id = si.sale_id
     JOIN customer c ON c.id = s.customer_id
     JOIN purchase_invoice_item pii ON pii.id = si.purchase_item_id
     JOIN product p ON p.id = pii.product_id;

-- public.customer_sale_view source

CREATE OR REPLACE VIEW public.customer_sale_view
AS SELECT c.id AS customer_id,
    c.name,
    c.mobile,
    max(s.id) AS last_bill_id,
    min(s.bill_date) AS first_bill_date,
    max(s.bill_date) AS last_bill_date,
    date_part('year'::text, max(s.bill_date)) * 12::double precision + date_part('month'::text, max(s.bill_date)) - (date_part('year'::text, min(s.bill_date)) * 12::double precision + date_part('month'::text, min(s.bill_date))) AS age_in_months,
    date_part('year'::text, now()) * 12::double precision + date_part('month'::text, now()) - (date_part('year'::text, max(s.bill_date)) * 12::double precision + date_part('month'::text, max(s.bill_date))) AS visit_months_ago
   FROM sale s
     JOIN customer c ON c.id = s.customer_id
  GROUP BY c.id, c.name, c.mobile;