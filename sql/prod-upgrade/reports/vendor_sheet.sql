-- Vendor sheet. Fill the blank cells and load with: scripts/prod-upgrade.sh load-vendors <file.csv>
-- An empty cell keeps what is stored. The cells start filled with what is stored today, so load a FRESH export (an old
-- sheet would put old values back) and delete the rows you did not touch. State and PAN follow from the GSTIN.
--   vendor_type          DISTRIBUTOR | MANUFACTURER | LOCAL | OTHER
--   registration_type    REGULAR | COMPOSITION | UNREGISTERED | UNKNOWN (a GSTIN means REGULAR or COMPOSITION)
--   gstn                 15 characters; checked for format, state and the last (check) character
--   state_code           2 digits, only for vendors without a GSTIN
--   mobile, rep_phone    10-digit mobile numbers
--   phone                any other phone numbers as free text (landline, extra mobiles), up to 40 characters
--   comments             free text, up to 400 characters; a non-empty cell REPLACES the stored comment
--   payment_terms_days   whole days; credit_limit in rupees; discount_pcnt 0-100
--   licences             items separated by ';', each TYPE:number or TYPE:number@YYYY-MM-DD (the end date)
--                        TYPE = WHOLESALE_20B_21B | RETAIL_20_21 | MANUFACTURING | FSSAI | OTHER.
--                        Listed licences are added or get their end date updated; none is ever removed by the sheet.
--   bank_ifsc            like HDFC0001234; upi_id like name@bank
select v.id as vendor_id, v.business_name,
       coalesce(v.legal_name, '') as legal_name, coalesce(v.vendor_type, '') as vendor_type, v.registration_type,
       coalesce(v.gstn, '') as gstn, coalesce(v.state_code, '') as state_code,
       coalesce(v.address, '') as address, coalesce(v.city, '') as city, coalesce(v.pincode, '') as pincode,
       coalesce(v.contact_name, '') as contact_name, coalesce(v.contact_phone, '') as phone,
       coalesce(v.mobile, '') as mobile, coalesce(v.email, '') as email,
       coalesce(v.rep_name, '') as rep_name, coalesce(v.rep_phone, '') as rep_phone,
       coalesce(v.payment_terms_days::text, '') as payment_terms_days,
       coalesce(v.credit_limit::text, '') as credit_limit, coalesce(v.discount_pcnt::text, '') as discount_pcnt,
       coalesce((select string_agg(l.license_type || ':' || l.number || coalesce('@' || to_char(l.valid_to, 'YYYY-MM-DD'), ''), '; ' order by l.license_type, l.number)
                   from vendor_license l where l.vendor_id = v.id), '') as licences,
       coalesce(v.bank_name, '') as bank_name, coalesce(v.bank_account, '') as bank_account,
       coalesce(v.bank_ifsc, '') as bank_ifsc, coalesce(v.upi_id, '') as upi_id,
       coalesce(v.comments, '') as comments,
       (select count(*) from purchase_invoice i where i.vendor_id = v.id and i.status = 'COMPLETE') as invoices,
       (select round(coalesce(sum(i.total), 0)::numeric) from purchase_invoice i where i.vendor_id = v.id and i.status = 'COMPLETE'
           and i.invoice_date >= current_date - 365) as purchased_last_12_months
  from vendor v
 where v.active and not v.archive
 order by purchased_last_12_months desc, v.business_name
