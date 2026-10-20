-- business.sql (one-off, prod upgrade). Prod's only business row carries a placeholder name.
-- gstin, legal_name, state_code, address and pincode are empty after upgrade; fill them in
-- Settings -> Businesses (needed for GST reports and bills).
update public.business set name = 'Ramesh Generic Pharmacy' where id = 1 and name = 'MK Enterprises';
select id, name, gstin, legal_name, state_code from public.business;
