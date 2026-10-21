-- approval: required
-- 06_price_above_mrp_cap.sql
-- A sale price may not be above the MRP. Where the price in force is above the MRP of the product's latest purchase
-- (the same MRP the price page shows; with several lines on that invoice the lowest is used), it is capped at that MRP.
-- Changes money on the shelf, so it needs --approve 06 after the review list (reports/price_review.sql) has been read:
-- an absurd price (115200 against an MRP of 1499) is capped here, but a wrong purchase cost (PTR) behind a huge margin
-- still shows up in the review list for a person to correct.
-- Old prices are kept in price_data_fix_log. Safe to run twice; a dry run only counts.
\set ON_ERROR_STOP on

create temp table _cap as
with latest as (
  select pii.product_id, min(pii.mrp_cost) as mrp
    from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
   where pii.mrp_cost > 0 and pii.ptr_cost > 0
     and pi.invoice_date = (select max(pi2.invoice_date) from purchase_invoice_item pii2
                              join purchase_invoice pi2 on pi2.id = pii2.invoice_id where pii2.product_id = pii.product_id)
   group by pii.product_id)
select pp.id as price_row, pp.product_id, pp.sale_price as old_price, round(l.mrp::numeric, 2)::real as new_price
  from product_price2 pp join latest l on l.product_id = pp.product_id
 where pp.end_date > current_date and pp.active and round(pp.sale_price::numeric, 2) > round(l.mrp::numeric, 2)
   and not exists (select 1 from product_price2 o
                    where o.id <> pp.id and o.product_id = pp.product_id and o.eff_date = pp.eff_date
                      and o.sale_price = round(l.mrp::numeric, 2)::real and o.end_date = pp.end_date);

select count(*) as n from _cap \gset
\echo FIX 06: prices in force above the MRP: :n

\if :dry_run
\echo FIX 06: dry run, nothing changed
\else
  create table if not exists price_data_fix_log (
    id          serial primary key,
    product_id  int4 not null,
    price_row   int4 not null,
    old_price   real,
    new_price   real,
    reason      varchar(40),
    fixed_on    timestamptz not null default now()
  );
  insert into price_data_fix_log (product_id, price_row, old_price, new_price, reason)
    select product_id, price_row, old_price, new_price, 'capped at MRP' from _cap;
  update product_price2 pp set sale_price = c.new_price, updated_on = now()
    from _cap c where pp.id = c.price_row;
\endif

drop table _cap;
