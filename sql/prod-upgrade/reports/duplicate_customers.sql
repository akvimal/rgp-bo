select c.mobile, count(*) over (partition by c.mobile) as records_with_this_mobile, c.id as customer_id, c.name,
       (select count(*) from sale s where s.customer_id = c.id and s.status = 'COMPLETE') as bills,
       (select max(s.bill_date)::date from sale s where s.customer_id = c.id and s.status = 'COMPLETE') as last_bill,
       'keep or merge into id: ' as decision
  from customer c
 where c.active and not c.archive and c.mobile ~ '^[0-9]{10}$' and c.mobile <> '0000000000'
   and c.mobile in (select mobile from customer where active and not archive and mobile ~ '^[0-9]{10}$' and mobile <> '0000000000'
                    group by mobile having count(*) > 1)
 order by c.mobile, bills desc, c.id
