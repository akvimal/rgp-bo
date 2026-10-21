-- Applied by `scripts/prod-upgrade.sh load-opening-stock <csv>` after the CSV rows are in _o_in (columns as in
-- reports/opening_stock_sheet.sql) and a transaction is open. Variables: dry_run (0/1), optional store_id.
--
-- The shelf count becomes the stock on the books, for every product that has a counted line:
--   * an existing batch that matches a line (same batch no. and expiry month) is adjusted to the counted units;
--   * every other batch of that product is adjusted to zero (this clears the negative / phantom balances);
--   * a line with no matching batch becomes a new batch on one "OPENING-<date>" purchase invoice (vendor
--     "OPENING STOCK", total 0, no GST period, so it stays out of payables and GST reconciliation), costed from the
--     product's latest purchase unless mrp / ptr are given on the line.
-- All adjustments are approved "Opening stock" corrections attributed to the first active Business Head.
-- Products without a counted line are not touched. Running the same sheet twice changes nothing.
\set ON_ERROR_STOP on

select coalesce((select min(id) from stores where active and not archive), 0) as def_store,
       (select count(*) from stores where active and not archive) as store_count \gset
\if :{?store_id}
  \set store_id_given 1
\else
  \set store_id :def_store
  \set store_id_given 0
\endif
select coalesce((select u.id from app_user u join app_role r on r.id = u.role_id
                  where r.name = 'Business Head' and u.active and not u.archive order by u.id limit 1), 0) as actor_id \gset

create temp table _errs (rn int, msg text);

-- ---------------------------------------------------------------- parse the counted lines
create temp table _o as
select row_number() over () as rn,
       case when trim(product_id) ~ '^[0-9]{1,9}$' then trim(product_id)::int end as pid,
       trim(strips) as strips_raw, trim(loose_units) as loose_raw,
       case when trim(strips) ~ '^[0-9]{1,7}$' then trim(strips)::int end as strips,
       case when trim(loose_units) ~ '^[0-9]{1,7}$' then trim(loose_units)::int end as loose,
       coalesce(nullif(upper(trim(batch)), ''), 'OPENING') as bkey,
       nullif(trim(batch), '') as batch_txt,
       trim(expiry) as expiry_raw,
       case when trim(expiry) ~ '^[0-9]{4}-(0[1-9]|1[0-2])(-[0-9]{2})?$' then make_date(substr(trim(expiry), 1, 4)::int, substr(trim(expiry), 6, 2)::int, 1)
            when trim(expiry) ~ '^(0[1-9]|1[0-2])/[0-9]{4}$' then make_date(substr(trim(expiry), 4, 4)::int, substr(trim(expiry), 1, 2)::int, 1) end as exp,
       case when trim(mrp) ~ '^[0-9]+(\.[0-9]+)?$' then trim(mrp)::float8 end as mrp,
       case when trim(ptr) ~ '^[0-9]+(\.[0-9]+)?$' then trim(ptr)::float8 end as ptr
  from _o_in
 where coalesce(trim(strips), '') <> '' or coalesce(trim(loose_units), '') <> '';

insert into _errs select rn, 'product_id is not a number' from _o where pid is null;
insert into _errs select o.rn, 'product ' || o.pid || ' does not exist or is not active' from _o o
 where o.pid is not null and not exists (select 1 from product p where p.id = o.pid and p.active and not p.archive);
insert into _errs select rn, 'strips / loose_units must be whole numbers (0 or more)' from _o
 where (strips_raw <> '' and strips is null) or (loose_raw <> '' and loose is null);
insert into _errs select rn, 'expiry "' || expiry_raw || '" is not YYYY-MM' from _o where expiry_raw <> '' and exp is null;
insert into _errs select 0, 'more than one store exists: pass -v store_id=N' where :store_count > 1 and :store_id_given = 0;
insert into _errs select 0, 'no active Business Head user to attribute the adjustments to' where :actor_id = 0;

create temp table _oc as
select o.*, p.pack, coalesce(o.strips, 0) * p.pack + coalesce(o.loose, 0) as units, p.title as ptitle
  from _o o join product p on p.id = o.pid and p.active and not p.archive;

insert into _errs select rn, 'expiry is needed for ' || units || ' units of ' || ptitle from _oc where units > 0 and exp is null;
insert into _errs select rn, 'expiry ' || to_char(exp, 'YYYY-MM') || ' has passed (' || ptitle || '): leave expired stock out of the count' from _oc
 where units > 0 and exp < date_trunc('month', current_date);
insert into _errs select min(rn), 'the same product, batch and expiry appears more than once (' || max(ptitle) || ')' from _oc
 group by pid, bkey, exp having count(*) > 1;

-- ---------------------------------------------------------------- existing batches of the counted products
create temp table _ex as
select pii.id as item_id, pii.product_id as pid, pi.store_id,
       coalesce(nullif(upper(trim(pii.batch)), ''), 'OPENING') as bkey,
       date_trunc('month', pii.exp_date)::date as exp,
       pii.id as sort_id,
       ((pii.qty + coalesce(pii.free_qty, 0)) * p.pack
        - coalesce((select sum(si.qty) from sale_item si join sale s on s.id = si.sale_id
                     where si.purchase_item_id = pii.id and s.status = 'COMPLETE' and si.active and not si.archive), 0)
        + coalesce((select sum(pq.qty) from product_qtychange pq
                     where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.active and not pq.archive), 0))::int as avail
  from purchase_invoice_item pii
  join purchase_invoice pi on pi.id = pii.invoice_id and pi.active and not pi.archive
  join product p on p.id = pii.product_id
 where pii.status = 'VERIFIED' and pii.active and not pii.archive
   and pii.product_id in (select pid from _oc);

-- one adjustment per existing batch whose quantity is not already what was counted
create temp table _adj as
with ranked as (
  select e.*, row_number() over (partition by e.pid, e.bkey, e.exp order by e.avail desc, e.sort_id) as rk from _ex e)
select e.item_id, e.store_id,
       (case when e.rk = 1 then coalesce(c.units, 0) else 0 end) - e.avail as delta,
       (c.rn is not null and e.rk = 1) as matched
  from ranked e
  left join _oc c on c.pid = e.pid and c.bkey = e.bkey and c.exp is not distinct from e.exp
 where (case when e.rk = 1 then coalesce(c.units, 0) else 0 end) - e.avail <> 0;

-- counted lines with stock that no existing batch matches become new batches
create temp table _new as
select c.rn, c.pid, c.units, c.pack, c.bkey, c.batch_txt, c.exp,
       ((c.units + c.pack - 1) / c.pack) as packs,
       coalesce(c.ptr, last.ptr_cost) as ptr_cost, coalesce(c.mrp, last.mrp_cost) as mrp_cost,
       last.tax_pcnt, last.hsn
  from _oc c
  left join lateral (
     select pii.ptr_cost, pii.mrp_cost, pii.tax_pcnt, pii.hsn
       from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
      where pii.product_id = c.pid and pii.status = 'VERIFIED' and pii.active and not pii.archive
      order by pi.invoice_date desc, pii.id desc limit 1) last on true
 where c.units > 0
   and not exists (select 1 from _ex e where e.pid = c.pid and e.bkey = c.bkey and e.exp is not distinct from c.exp);

insert into _errs select n.rn, 'no cost to copy for new batch of ' || p.title || ': give mrp and ptr on the line'
  from _new n join product p on p.id = n.pid where n.ptr_cost is null or n.mrp_cost is null;

-- ---------------------------------------------------------------- report / abort
select count(*) as n_errs_n, count(*) > 0 as n_errs from _errs \gset
select count(distinct pid) as n_products, coalesce(sum(units), 0) as n_units from _oc \gset
select count(*) as n_adj, count(*) filter (where delta > 0) as n_up, count(*) filter (where delta < 0) as n_down,
       coalesce(sum(delta) filter (where delta > 0), 0) as units_up, coalesce(sum(delta) filter (where delta < 0), 0) as units_down from _adj \gset
select count(*) as n_new, coalesce(sum(units), 0) as new_units from _new \gset
select count(*) as n_lines, count(*) filter (where units = 0) as n_zero_lines from _oc \gset

\echo LOAD: :n_lines counted line(s) for :n_products product(s), :n_units units on the shelf (:n_zero_lines zero line(s))
\echo LOAD: :n_adj existing batch(es) adjusted (:n_up up by :units_up units, :n_down down by :units_down units)
\echo LOAD: :n_new new opening batch(es) holding :new_units units

\if :n_errs
  \echo LOAD ABORTED: :n_errs_n problem(s), first 40:
  select 'LOAD ROW ' || rn || ': ' || msg as problem from _errs order by rn, msg limit 40;
  rollback;
  \quit 1
\endif

-- ---------------------------------------------------------------- write
\if :dry_run
  \echo LOAD: dry run, nothing written
  rollback;
  \quit 0
\endif

insert into vendor (business_name, active, archive, created_by, updated_by)
select 'OPENING STOCK', true, false, :actor_id, :actor_id
 where not exists (select 1 from vendor where business_name = 'OPENING STOCK');

select 'OPENING-' || to_char(current_date, 'YYYYMMDD') as inv_no \gset
insert into purchase_invoice (invoice_no, invoice_date, vendor_id, status, invoice_type, store_id, total, created_by, updated_by)
select :'inv_no', current_date, (select id from vendor where business_name = 'OPENING STOCK' order by id limit 1),
       'COMPLETE', 'OPENING', :store_id, 0, :actor_id, :actor_id
 where :n_new > 0 and not exists (select 1 from purchase_invoice where invoice_no = :'inv_no' and invoice_type = 'OPENING');

create temp table _created_items (item_id int, rn int);
with ins as (
  insert into purchase_invoice_item (invoice_id, product_id, batch, exp_date, ptr_cost, mrp_cost, tax_pcnt, hsn, qty, status, created_by, updated_by, verified_by)
  select (select id from purchase_invoice where invoice_no = :'inv_no' and invoice_type = 'OPENING' order by id limit 1),
         n.pid, coalesce(n.batch_txt, 'OPENING'), n.exp, n.ptr_cost, n.mrp_cost, n.tax_pcnt, n.hsn, n.packs, 'VERIFIED', :actor_id, :actor_id, :actor_id
    from _new n order by n.rn
  returning id, product_id, batch, exp_date, qty)
insert into _created_items select ins.id, n.rn
  from ins join _new n on n.pid = ins.product_id and coalesce(n.batch_txt, 'OPENING') = ins.batch and n.exp = ins.exp_date;

-- whole packs cannot always equal the counted units: trim the odd extra units off the new batch
insert into _adj (item_id, store_id, delta, matched)
select ci.item_id, :store_id, n.units - n.packs * n.pack, false
  from _new n join _created_items ci on ci.rn = n.rn where n.units - n.packs * n.pack <> 0;

insert into product_qtychange (item_id, qty, reason, reason_code, comments, status, store_id, created_by, updated_by)
select item_id, delta, 'Opening stock', 'CORRECTION', 'Opening stock count ' || to_char(current_date, 'YYYY-MM-DD'), 'APPROVED', store_id, :actor_id, :actor_id
  from _adj;

-- ---------------------------------------------------------------- verify: every counted product now equals its count
create temp table _check as
with target as (select pid, sum(units)::int as units from _oc group by pid),
now_ as (
  select pii.product_id as pid,
         sum((pii.qty + coalesce(pii.free_qty, 0)) * p.pack
             - coalesce((select sum(si.qty) from sale_item si join sale s on s.id = si.sale_id
                          where si.purchase_item_id = pii.id and s.status = 'COMPLETE' and si.active and not si.archive), 0)
             + coalesce((select sum(pq.qty) from product_qtychange pq
                          where pq.item_id = pii.id and coalesce(pq.status, 'APPROVED') = 'APPROVED' and pq.active and not pq.archive), 0))::int as units
    from purchase_invoice_item pii join product p on p.id = pii.product_id
   where pii.status = 'VERIFIED' and pii.active and not pii.archive and pii.product_id in (select pid from target) group by 1)
select t.pid, t.units as counted, coalesce(n.units, 0) as on_books from target t left join now_ n using (pid) where t.units <> coalesce(n.units, 0);
select count(*) as n_mismatch_n, count(*) > 0 as n_mismatch from _check \gset
\if :n_mismatch
  \echo LOAD ABORTED: :n_mismatch_n product(s) do not match their count after posting, rolled back
  select 'LOAD MISMATCH product ' || pid || ': counted ' || counted || ', books ' || on_books as problem from _check limit 20;
  rollback;
  \quit 1
\endif
\echo LOAD: posted. Every counted product now matches its count.
commit;
