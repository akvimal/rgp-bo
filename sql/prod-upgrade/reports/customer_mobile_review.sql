-- Customers whose mobile still needs a person after fix 04: placeholders, test digits, short or foreign numbers, and
-- records with no name. The NIL walk-in customer (0000000000) is left out on purpose. Busiest first.
select c.id as customer_id, c.name, c.mobile,
       case when c.mobile ~ '^[6-9][0-9]{9}$'                        then 'no name'
            when c.mobile ~ '^([0-9])\1{9}$'                         then 'repeated digit'
            when c.mobile in ('1234567890', '0123456789', '9876543210') then 'sequence'
            when c.mobile ~ '^\+'                                    then 'foreign number'
            when c.mobile ~ '^[0-9]+$' and length(c.mobile) < 10     then 'too short'
            when c.mobile ~ '^[0-9]{10}$'                            then 'does not start 6-9 (test or landline)'
            when c.mobile is not null                                then 'other'
            else 'no name' end as problem,
       count(s.id) as bills, max(s.bill_date)::date as last_bill
  from customer c left join sale s on s.customer_id = c.id and s.status = 'COMPLETE'
 where c.mobile is distinct from '0000000000'
   and ((c.mobile is not null and c.mobile !~ '^[6-9][0-9]{9}$')
        or coalesce(btrim(c.name), '') = '')
 group by c.id, c.name, c.mobile
 order by bills desc, c.id;
