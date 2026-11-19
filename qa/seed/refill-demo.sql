-- Refill demo data for a LOCAL TEST database (never production). Plants chronic medicines, regular customers with monthly purchase histories, and the contacts
-- made about them, so the Refills page, My follow-ups, the scorecard and the retry alerts have something to show. All dates are relative to today, so the
-- picture is the same whenever it is run. Safe to run again: what it planted before (tagged "refill-demo") is removed first.
--
--   docker exec -i rgp-db-dev psql -U rgpapp -d rgp_local -v ON_ERROR_STOP=1 < qa/seed/refill-demo.sql
--
-- What each customer shows (units are tablets; 30 units a month = 1 a day, so a purchase of 30 lasts 30 days):
--   1  last bought 40 days ago          -> 10 days overdue on their own pattern
--   2  last bought 33 days ago          -> 3 days overdue
--   3  last bought 27 days ago          -> due in 3 days
--   4  last bought 22 days ago          -> due in 8 days: not on the list yet
--   5  last bought 85 days ago          -> lapsed (more than 45 days late)
--   6  two medicines, one runs out first -> the row names only the one that is due
--   7  a medicine with no stock         -> "Not in stock"
--   8  bought a 90-unit pack 40 days ago -> not due for 50 days: off the list although the visit gap says otherwise
--   9  called 5 days ago, bought 3 days later -> came back (the scorecard)
-- Contacts: customer 1 no answer 4 days ago (call again), 2 a WhatsApp message 4 days ago (nudge), and 5, 7 and 8 reached 10-12 days ago with no purchase since
-- (three lapsed customers: the weekly roll-up for the managers).

begin;

-- ---------------------------------------------------------------- clear what an earlier run planted
delete from sale_item where sale_id in (select id from sale where (more_props::jsonb ->> 'seed') = 'refill-demo');
delete from sale where (more_props::jsonb ->> 'seed') = 'refill-demo';
delete from customer_contact_log where note = 'refill-demo';

-- ---------------------------------------------------------------- the medicines
-- eight with stock on hand, two with no stock at all; the first three also say how long a unit lasts (the product default)
create temp table demo_meds as
  (select row_number() over (order by product_id) as n, product_id, true as stocked
     from (select product_id from inventory_view where active group by product_id having sum(available) > 200 order by product_id limit 8) s)
  union all
  (select 8 + row_number() over (order by id), id, false
     from (select p.id from product p where not exists (select 1 from purchase_invoice_item i where i.product_id = p.id) order by p.id limit 2) u);

update product p set more_props = coalesce(p.more_props::jsonb, '{}'::jsonb) || jsonb_build_object('chronic', 'true')
  where p.id in (select product_id from demo_meds);
update product p set more_props = p.more_props::jsonb || jsonb_build_object('supplyDays', '1')
  where p.id in (select product_id from demo_meds where n <= 3);

-- ---------------------------------------------------------------- the customers: regulars with a real mobile who have not bought these medicines before
create temp table demo_cust as
  select row_number() over (order by c.id) as k, c.id as customer_id
    from customer c
   where c.active and not c.archive and c.mobile ~ '^[0-9]{10}$' and c.mobile <> '0000000000' and c.id > 150
     and not exists (select 1 from sale s join sale_item si on si.sale_id = s.id where s.customer_id = c.id and si.product_id in (select product_id from demo_meds))
   order by c.id limit 9;

-- ---------------------------------------------------------------- the purchases
do $$
declare
  store int := (select id from stores order by id limit 1);
  maker int := coalesce((select id from app_user where email = 'sales1@local.test'), (select min(id) from app_user));
  bill int := coalesce((select max(bill_no) from sale where store_id = store), 0);
  rec record;
  d int; q int; i int; med int; sale_id int;
  -- customer k: medicine number, days since the last purchase, units in the last purchase, extra purchase days ago (second medicine / the return)
  plan int[][] := array[
    [1, 40, 30], [2, 33, 30], [3, 27, 30], [4, 22, 30], [5, 85, 30], [6, 35, 30], [7, 40, 30], [8, 40, 90], [1, 33, 30]
  ];
  p_med int; p_days int; p_qty int;
begin
  for rec in select k, customer_id from demo_cust order by k loop
    p_med := plan[rec.k][1]; p_days := plan[rec.k][2]; p_qty := plan[rec.k][3];
    -- customer 7 buys the first medicine with no stock (number 9); customer 6 buys medicine 6, and 5 as well, 20 days later
    med := (select product_id from demo_meds where n = case when rec.k = 7 then 9 else p_med end);
    for i in 0..3 loop
      d := p_days + 30 * i;                                  -- the last purchase p_days ago, earlier ones a month apart
      q := case when i = 0 then p_qty else 30 end;
      bill := bill + 1;
      insert into sale (bill_date, customer_id, status, active, total, store_id, created_by, bill_no, more_props)
        values ((current_date - d)::timestamp + time '11:00', rec.customer_id, 'COMPLETE', true, q * 4, store, maker, bill, '{"seed":"refill-demo"}'::json)
        returning id into sale_id;
      insert into sale_item (sale_id, product_id, qty, price, total, status, created_by) values (sale_id, med, q, 4, q * 4, 'Complete', maker);
    end loop;
    -- customer 6: a second medicine bought last 10 days ago (so it is not the one that is due), monthly before that
    if rec.k = 6 then
      med := (select product_id from demo_meds where n = 5);
      for i in 0..3 loop
        bill := bill + 1;
        insert into sale (bill_date, customer_id, status, active, total, store_id, created_by, bill_no, more_props)
          values ((current_date - (10 + 30 * i))::timestamp + time '11:30', rec.customer_id, 'COMPLETE', true, 120, store, maker, bill, '{"seed":"refill-demo"}'::json)
          returning id into sale_id;
        insert into sale_item (sale_id, product_id, qty, price, total, status, created_by) values (sale_id, med, 30, 4, 120, 'Complete', maker);
      end loop;
    end if;
    -- customer 9: bought again 3 days ago, after being called 5 days ago
    if rec.k = 9 then
      bill := bill + 1;
      insert into sale (bill_date, customer_id, status, active, total, store_id, created_by, bill_no, more_props)
        values ((current_date - 3)::timestamp + time '12:00', rec.customer_id, 'COMPLETE', true, 120, store, maker, bill, '{"seed":"refill-demo"}'::json)
        returning id into sale_id;
      insert into sale_item (sale_id, product_id, qty, price, total, status, created_by) values (sale_id, med, 30, 4, 120, 'Complete', maker);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- the contacts
insert into customer_contact_log (customer_id, channel, audience, outcome, note, created_by, created_on, source, due_on, snoozed_until)
select c.customer_id, x.channel, 'due_back', x.outcome, 'refill-demo',
       coalesce((select id from app_user where email = 'sales1@local.test'), (select min(id) from app_user)),
       now() - (x.days || ' days')::interval, 'refill', (current_date - x.due_ago), null
  from (values
    (1, 'CALL',     'NO_ANSWER', 4, 10),    -- call again
    (2, 'WHATSAPP', 'SENT',      4, 3),     -- nudge
    (5, 'CALL',     'REACHED',  12, 50),    -- lapsed
    (7, 'CALL',     'REACHED',  11, 10),    -- lapsed
    (8, 'CALL',     'REACHED',  10, 10),    -- lapsed
    (9, 'CALL',     'REACHED',   5, 2)      -- came back
  ) as x(k, channel, outcome, days, due_ago)
  join demo_cust c on c.k = x.k;

commit;

select 'chronic medicines' as what, count(*)::text as n from demo_meds
union all select 'customers', count(*)::text from demo_cust
union all select 'purchases', count(*)::text from sale where (more_props::jsonb ->> 'seed') = 'refill-demo'
union all select 'contacts', count(*)::text from customer_contact_log where note = 'refill-demo';
