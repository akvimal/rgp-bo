-- 05_customer_name_tidy.sql
-- Customer names, the safe part: stray spaces are trimmed and collapsed, and a name written entirely in capitals (or
-- entirely in lower case) becomes Title Case. A name that already mixes cases (McDonald, A. K. Raj, "RAJENDIRAN lawyer")
-- keeps its capitals and only has the spaces tidied, because it cannot be told apart from a deliberate spelling.
-- Skipped: the NIL walk-in customer (0000000000), and any change that would give two customers the same name and
-- mobile (the table is unique on that pair). The same rule is applied to new entries by the API.
-- Old values are kept in customer_data_fix_log. Safe to run twice; a dry run only counts.
\set ON_ERROR_STOP on

create temp table _name_fix as
with cand as (
  select c.id, c.mobile, c.name as old_name,
         btrim(regexp_replace(c.name, '\s+', ' ', 'g')) as spaced
    from customer c
   where c.name is not null and c.mobile is distinct from '0000000000'
), tidy as (
  select id, mobile, old_name,
         case when (spaced !~ '[a-z]' and spaced ~ '[A-Z]') or (spaced !~ '[A-Z]' and spaced ~ '[a-z]')
              then initcap(lower(spaced)) else spaced end as new_name
    from cand
), changed as (
  select *, row_number() over (partition by new_name, mobile order by id) as rn
    from tidy where new_name <> old_name and new_name <> ''
)
select id, old_name, new_name,
       case when btrim(regexp_replace(old_name, '\s+', ' ', 'g')) = new_name then 'spaces' else 'case' end as kind
  from changed c
 where rn = 1
   and not exists (select 1 from customer o
                    where o.id <> c.id and o.mobile = c.mobile and o.name = c.new_name);

select count(*) filter (where kind = 'spaces') as n_spaces,
       count(*) filter (where kind = 'case')   as n_case
  from _name_fix \gset
\echo FIX 05: names to tidy: spaces only :n_spaces, capitals to Title Case :n_case

\if :dry_run
\echo FIX 05: dry run, nothing changed
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
    select id, 'name', old_name, new_name, kind from _name_fix;
  update customer c set name = f.new_name, updated_on = now()
    from _name_fix f where c.id = f.id;
\endif

drop table _name_fix;
