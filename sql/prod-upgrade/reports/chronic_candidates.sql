-- Products with no chronic flag that behave like chronic medicines: bought repeatedly by the same customers.
-- A customer counts as a repeat buyer when they bought the product on 3 or more different days, at least a week apart.
with visits as (
  select s.customer_id, si.product_id, s.bill_date::date as d
    from sale s join sale_item si on si.sale_id = s.id
    join customer c on c.id = s.customer_id
   where s.status = 'COMPLETE' and c.mobile ~ '^[0-9]{10}$' and c.mobile <> '0000000000'
   group by 1, 2, 3),
repeat_buyers as (
  select product_id, customer_id, count(*) as days_bought
    from (select customer_id, product_id, d, d - lag(d) over (partition by customer_id, product_id order by d) as gap from visits) g
   where gap is null or gap >= 7
   group by 1, 2 having count(*) >= 3)
select p.id as product_id, p.title, coalesce(nullif(p.category, ''), '(none)') as category,
       count(*) as repeat_customers, max(rb.days_bought) as most_visits_by_one_customer,
       'chronic? y/n: ' as decision
  from repeat_buyers rb join product p on p.id = rb.product_id
 where p.active and not p.archive
   and coalesce((p.more_props::jsonb)->>'chronic', '') not in ('true', 'false')
 group by p.id, p.title, p.category
having count(*) >= 3
 order by count(*) desc
