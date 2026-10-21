-- Fill the blank columns and load with: scripts/prod-upgrade.sh load-vendors <file.csv>
-- Leave a cell empty to keep what is stored. GSTIN is 15 characters; terms are whole days.
select v.id as vendor_id, v.business_name, coalesce(v.gstn, '') as gstn, coalesce(v.payment_terms_days::text, '') as payment_terms_days,
       coalesce(v.contact_phone, '') as contact_phone,
       (select count(*) from purchase_invoice i where i.vendor_id = v.id and i.status = 'COMPLETE') as invoices,
       (select round(coalesce(sum(i.total), 0)::numeric) from purchase_invoice i where i.vendor_id = v.id and i.status = 'COMPLETE'
           and i.invoice_date >= current_date - 365) as purchased_last_12_months
  from vendor v
 where v.active and not v.archive
 order by purchased_last_12_months desc, v.business_name
