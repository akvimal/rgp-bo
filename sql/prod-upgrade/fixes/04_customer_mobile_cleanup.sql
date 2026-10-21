-- 04_customer_mobile_cleanup.sql
-- Customer mobile numbers, the safe part only:
--   blank      an empty or whitespace-only mobile becomes NULL (nothing is known, so say so);
--   format     a number written with spaces, dashes, +91, 91 or a leading 0 becomes the plain 10 digits, unless that
--              would clash with another customer of the same name and number;
--   text       a "mobile" that has no digits at all (e.g. HAND BILL) becomes NULL.
-- Every non-blank change is kept in customer_data_fix_log (old value -> new value), so nothing is lost.
-- Not touched: the NIL customer (0000000000), foreign numbers, short numbers, repeated or test digits
-- (1234567890, 1111111111): those need a person, see reports/customer_mobile_review.sql.
-- Safe to run twice: the second run finds nothing. A dry run only counts.
\set ON_ERROR_STOP on

create temp table _mob_fix as
with cand as (
  select c.id, c.name, c.mobile as old_mobile,
         regexp_replace(c.mobile, '[^0-9]', '', 'g') as digits,
         case when btrim(c.mobile) = '' then 'blank'
              when c.mobile !~ '[0-9]' then 'text'
              else 'format' end as kind
    from customer c
   where c.mobile is not null
     and c.mobile !~ '^[6-9][0-9]{9}$'
)
select id, old_mobile,
       case when kind = 'format' then right(digits, 10) end as new_mobile,
       kind
  from cand c
 where kind in ('blank', 'text')
    or (kind = 'format'
        and digits ~ '^(91|0)?[6-9][0-9]{9}$'
        and not exists (select 1 from customer o
                         where o.id <> c.id and o.name is not distinct from c.name and o.mobile = right(c.digits, 10)));

select count(*) filter (where kind = 'blank')  as n_blank,
       count(*) filter (where kind = 'format') as n_format,
       count(*) filter (where kind = 'text')   as n_text
  from _mob_fix \gset
\echo FIX 04: mobiles to clean: blank :n_blank, formatting :n_format, text only :n_text

\if :dry_run
\echo FIX 04: dry run, nothing changed
\else
  create table if not exists customer_data_fix_log (
    id          serial primary key,
    customer_id int4 not null,
    field       varchar(30) not null,
    old_value   varchar,
    new_value   varchar,
    reason      varchar(40),
    fixed_on    timestamptz not null default now()
  );
  insert into customer_data_fix_log (customer_id, field, old_value, new_value, reason)
    select id, 'mobile', old_mobile, new_mobile, kind from _mob_fix where kind <> 'blank';
  update customer c set mobile = f.new_mobile, updated_on = now()
    from _mob_fix f where c.id = f.id;
\endif

drop table _mob_fix;
