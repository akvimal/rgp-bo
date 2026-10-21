-- Applied by `scripts/prod-upgrade.sh load-vendors <csv>` after the CSV rows have been copied into _v_in
-- (columns as in reports/vendor_sheet.sql). Runs inside a transaction opened by the script.
-- Empty cells keep the stored value. Any bad value aborts the whole load with a list of what is wrong.
-- The rules are the ones the vendor screen applies (migration 043 and the vendor API).
\set ON_ERROR_STOP on

create temp table _verr (vendor_id text, msg text);

-- unknown vendor ids
insert into _verr select i.vendor_id, 'vendor_id does not exist' from _v_in i
 where not (trim(i.vendor_id) ~ '^[0-9]{1,9}$') or not exists (select 1 from vendor v where v.id = trim(i.vendor_id)::int);

-- one working row per vendor with cleaned values (null = leave as is)
create temp table _v as
select trim(i.vendor_id)::int as id,
       nullif(trim(i.legal_name), '') as legal_name,
       nullif(upper(trim(i.vendor_type)), '') as vendor_type,
       nullif(nullif(upper(trim(i.registration_type)), ''), 'UNKNOWN') as registration_type,   -- UNKNOWN is the default, never an instruction
       nullif(upper(trim(i.gstn)), '') as gstn,
       nullif(trim(i.state_code), '') as state_code,
       nullif(trim(i.address), '') as address, nullif(trim(i.city), '') as city, nullif(trim(i.pincode), '') as pincode,
       nullif(trim(i.contact_name), '') as contact_name, nullif(trim(i.phone), '') as phone, nullif(trim(i.comments), '') as comments,
       nullif(regexp_replace(regexp_replace(trim(i.mobile), '[^0-9]', '', 'g'), '^(91|0)(?=[0-9]{10}$)', ''), '') as mobile,
       nullif(trim(i.email), '') as email, nullif(trim(i.rep_name), '') as rep_name,
       nullif(regexp_replace(regexp_replace(trim(i.rep_phone), '[^0-9]', '', 'g'), '^(91|0)(?=[0-9]{10}$)', ''), '') as rep_phone,
       nullif(trim(i.payment_terms_days), '') as terms, nullif(trim(i.credit_limit), '') as credit_limit,
       nullif(trim(i.discount_pcnt), '') as discount_pcnt,
       nullif(trim(i.licences), '') as licences,
       nullif(trim(i.bank_name), '') as bank_name, nullif(trim(i.bank_account), '') as bank_account,
       nullif(upper(trim(i.bank_ifsc)), '') as bank_ifsc, nullif(trim(i.upi_id), '') as upi_id
  from _v_in i
 where trim(i.vendor_id) ~ '^[0-9]{1,9}$' and exists (select 1 from vendor v where v.id = trim(i.vendor_id)::int);

insert into _verr select id::text, 'vendor_type must be DISTRIBUTOR, MANUFACTURER, LOCAL or OTHER' from _v where vendor_type is not null and vendor_type not in ('DISTRIBUTOR','MANUFACTURER','LOCAL','OTHER');
insert into _verr select id::text, 'registration_type must be REGULAR, COMPOSITION, UNREGISTERED or UNKNOWN' from _v where registration_type is not null and registration_type not in ('REGULAR','COMPOSITION','UNREGISTERED','UNKNOWN');
-- only a GSTIN that is being changed is checked, so an old stored one does not block an unrelated update
insert into _verr select v.id::text, 'GSTIN ' || v.gstn || ' is not valid (format, state or check character)' from _v v join vendor o on o.id = v.id
 where v.gstn is not null and v.gstn is distinct from upper(btrim(o.gstn)) and not public.is_valid_gstin(v.gstn);
insert into _verr select v.id::text, 'GSTIN ' || v.gstn || ' is already used by "' || btrim(o.business_name) || '"' from _v v join vendor o on upper(btrim(o.gstn)) = v.gstn and o.id <> v.id and o.active
 where v.gstn is not null;
insert into _verr select min(id)::text, 'GSTIN ' || gstn || ' appears on two rows of the sheet' from _v where gstn is not null group by gstn having count(*) > 1;
insert into _verr select id::text, 'an unregistered vendor cannot have a GSTIN' from _v where registration_type = 'UNREGISTERED' and gstn is not null;
insert into _verr select v.id::text, 'a regular or composition vendor needs a GSTIN' from _v v join vendor o on o.id = v.id
 where v.registration_type in ('REGULAR','COMPOSITION') and coalesce(v.gstn, nullif(btrim(o.gstn), '')) is null;
insert into _verr select id::text, 'state_code is not a GST state code' from _v where state_code is not null and not (state_code ~ '^[0-9]{2}$' and (state_code::int between 1 and 38 or state_code::int in (97, 99)));
insert into _verr select id::text, 'pincode must be 6 digits' from _v where pincode is not null and pincode !~ '^[1-9][0-9]{5}$';
insert into _verr select id::text, 'mobile must be a 10-digit Indian mobile number' from _v where mobile is not null and mobile !~ '^[6-9][0-9]{9}$';
insert into _verr select id::text, 'rep_phone must be a 10-digit Indian mobile number' from _v where rep_phone is not null and rep_phone !~ '^[6-9][0-9]{9}$';
insert into _verr select id::text, 'email is not valid' from _v where email is not null and email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
insert into _verr select id::text, 'payment_terms_days must be whole days (0-365)' from _v where terms is not null and (terms !~ '^[0-9]{1,3}$' or terms::int > 365);
insert into _verr select id::text, 'credit_limit must be a number, 0 or more' from _v where credit_limit is not null and credit_limit !~ '^[0-9]{1,10}(\.[0-9]{1,2})?$';
insert into _verr select id::text, 'discount_pcnt must be between 0 and 100' from _v where discount_pcnt is not null and (discount_pcnt !~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' or discount_pcnt::numeric > 100);
insert into _verr select id::text, 'bank_ifsc must look like HDFC0001234' from _v where bank_ifsc is not null and bank_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$';
insert into _verr select id::text, 'bank_account must be 6 to 30 letters or digits' from _v where bank_account is not null and bank_account !~ '^[0-9A-Za-z]{6,30}$';
insert into _verr select id::text, 'upi_id must look like name@bank' from _v where upi_id is not null and upi_id !~ '^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$';
insert into _verr select id::text, 'phone is longer than 40 characters' from _v where length(phone) > 40;
insert into _verr select id::text, 'comments are longer than 400 characters' from _v where length(comments) > 400;

-- licences: "TYPE:number" or "TYPE:number@YYYY-MM-DD", separated by ';'
create temp table _vl as
select v.id as vendor_id, trim(split_part(item, ':', 1)) as license_type,
       trim(split_part(split_part(item, ':', 2), '@', 1)) as number,
       nullif(trim(split_part(item, '@', 2)), '') as valid_to, item
  from _v v, lateral regexp_split_to_table(v.licences, '\s*;\s*') as item
 where v.licences is not null and trim(item) <> '';
insert into _verr select vendor_id::text, 'licence "' || item || '": type must be WHOLESALE_20B_21B, RETAIL_20_21, MANUFACTURING, FSSAI or OTHER' from _vl
 where license_type not in ('WHOLESALE_20B_21B','RETAIL_20_21','MANUFACTURING','FSSAI','OTHER');
insert into _verr select vendor_id::text, 'licence "' || item || '": a number is needed (TYPE:number)' from _vl where number = '' or length(number) > 40;
insert into _verr select vendor_id::text, 'licence "' || item || '": the end date must be YYYY-MM-DD' from _vl
 where valid_to is not null and valid_to !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$';
insert into _verr select vendor_id::text, 'licence ' || number || ' is listed twice' from _vl group by vendor_id, license_type, number having count(*) > 1;

select count(*) as bad_n, count(*) > 0 as bad from _verr \gset
\if :bad
  select vendor_id, msg as problem from _verr order by vendor_id::int nulls last, msg limit 40;
  \echo LOAD ABORTED: :bad_n problem(s) in the vendor sheet
  rollback;
  \quit 1
\endif

with changed as (
  update vendor v set
    legal_name = coalesce(n.legal_name, v.legal_name),
    vendor_type = coalesce(n.vendor_type, v.vendor_type),
    gstn = coalesce(n.gstn, v.gstn),
    -- state and PAN come from a GSTIN only when this sheet changes it (the sheet repeats stored values)
    state_code = case when (n.gstn is not null and n.gstn is distinct from upper(btrim(v.gstn))) then substr(n.gstn, 1, 2) else coalesce(n.state_code, v.state_code) end,
    pan = case when (n.gstn is not null and n.gstn is distinct from upper(btrim(v.gstn))) then substr(n.gstn, 3, 10) else v.pan end,
    registration_type = case when (n.gstn is not null and n.gstn is distinct from upper(btrim(v.gstn))) and coalesce(n.registration_type, v.registration_type) = 'UNKNOWN' then 'REGULAR' else coalesce(n.registration_type, v.registration_type) end,
    address = coalesce(n.address, v.address), city = coalesce(n.city, v.city), pincode = coalesce(n.pincode, v.pincode),
    contact_name = coalesce(n.contact_name, v.contact_name), contact_phone = coalesce(n.phone, v.contact_phone),
    comments = coalesce(n.comments, v.comments), mobile = coalesce(n.mobile, v.mobile), email = coalesce(n.email, v.email),
    rep_name = coalesce(n.rep_name, v.rep_name), rep_phone = coalesce(n.rep_phone, v.rep_phone),
    payment_terms_days = coalesce(n.terms::int, v.payment_terms_days),
    credit_limit = coalesce(n.credit_limit::numeric, v.credit_limit), discount_pcnt = coalesce(n.discount_pcnt::numeric, v.discount_pcnt),
    bank_name = coalesce(n.bank_name, v.bank_name), bank_account = coalesce(n.bank_account, v.bank_account),
    bank_ifsc = coalesce(n.bank_ifsc, v.bank_ifsc), upi_id = coalesce(n.upi_id, v.upi_id),
    updated_on = now()
  from _v n
  where n.id = v.id
    and (   (n.legal_name is not null and n.legal_name is distinct from v.legal_name)
         or (n.vendor_type is not null and n.vendor_type is distinct from v.vendor_type)
         or (n.gstn is not null and n.gstn is distinct from upper(btrim(v.gstn)))
         or (n.state_code is not null and n.state_code is distinct from v.state_code)
         or (n.registration_type is not null and n.registration_type is distinct from v.registration_type)
         or (n.address is not null and n.address is distinct from v.address)
         or (n.city is not null and n.city is distinct from v.city)
         or (n.pincode is not null and n.pincode is distinct from v.pincode)
         or (n.contact_name is not null and n.contact_name is distinct from v.contact_name)
         or (n.phone is not null and n.phone is distinct from v.contact_phone)
         or (n.comments is not null and n.comments is distinct from v.comments)
         or (n.mobile is not null and n.mobile is distinct from v.mobile)
         or (n.email is not null and n.email is distinct from v.email)
         or (n.rep_name is not null and n.rep_name is distinct from v.rep_name)
         or (n.rep_phone is not null and n.rep_phone is distinct from v.rep_phone)
         or (n.terms is not null and n.terms::int is distinct from v.payment_terms_days)
         or (n.credit_limit is not null and n.credit_limit::numeric is distinct from v.credit_limit)
         or (n.discount_pcnt is not null and n.discount_pcnt::numeric is distinct from v.discount_pcnt)
         or (n.bank_name is not null and n.bank_name is distinct from v.bank_name)
         or (n.bank_account is not null and n.bank_account is distinct from v.bank_account)
         or (n.bank_ifsc is not null and n.bank_ifsc is distinct from v.bank_ifsc)
         or (n.upi_id is not null and n.upi_id is distinct from v.upi_id))
  returning v.id)
select count(*) as updated from changed \gset

with lic as (
  insert into vendor_license (vendor_id, license_type, number, valid_to)
  select vendor_id, license_type, number, valid_to::date from _vl
  on conflict (vendor_id, license_type, number) do update set valid_to = excluded.valid_to
   where excluded.valid_to is not null and vendor_license.valid_to is distinct from excluded.valid_to
  returning id)
select count(*) as licenses from lic \gset

\echo LOAD: :updated vendor(s) updated, :licenses licence(s) added or renewed

\if :dry_run
  \echo LOAD: dry run, rolled back
  rollback;
\else
  commit;
\endif
