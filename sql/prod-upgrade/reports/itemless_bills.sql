select s.id as sale_id, s.bill_no, s.bill_date::date, round(s.total::numeric, 2) as total, c.name as customer, u.full_name as billed_by,
       'keep or void: ' as decision
  from sale s
  left join customer c on c.id = s.customer_id
  left join app_user u on u.id = s.created_by
 where s.status = 'COMPLETE' and not exists (select 1 from sale_item i where i.sale_id = s.id)
 order by s.bill_date desc
