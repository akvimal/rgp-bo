select i.id as invoice_id, v.business_name as vendor, i.invoice_no, i.invoice_date, round(i.total::numeric, 2) as total,
       (select count(*) from purchase_invoice_item p where p.invoice_id = i.id) as lines,
       (current_date - i.invoice_date) as days_old, 'complete or delete: ' as decision
  from purchase_invoice i join vendor v on v.id = i.vendor_id
 where i.status = 'NEW'
 order by i.invoice_date
