-- How common are shared mobile numbers? READ ONLY: one read-only transaction of SELECTs, nothing is changed.
-- Part of docs/planning/CUSTOMER_HOUSEHOLDS.md (step 0: measure before deciding how much to build).
--
-- Counts only. No name or full number is printed; the optional sample (-v detail=1) shows the last 4 digits only.
-- "Customer" here is a live record (active, not archived). The walk-in "Nil" number 0000000000 and records with no mobile are left out of the sharing figures.
\set ON_ERROR_STOP on
\pset pager off
\pset null '-'
begin read only;

\echo
\echo '== 1. The customers'
select count(*) as live_customers,
       count(*) filter (where mobile is not null and mobile <> '0000000000') as with_a_mobile,
       count(*) filter (where mobile is null) as no_mobile,
       count(*) filter (where mobile = '0000000000') as nil_walkin
  from customer where active and not archive;

\echo
\echo '== 2. Numbers held by more than one customer (each such number would become one household)'
with n as (
  select mobile, count(*) as members from customer
   where active and not archive and mobile is not null and mobile <> '0000000000' group by mobile)
select count(*) as numbers,
       count(*) filter (where members > 1) as shared_numbers,
       round(100.0 * count(*) filter (where members > 1) / nullif(count(*), 0), 1) as pct_numbers_shared,
       coalesce(sum(members) filter (where members > 1), 0) as customers_on_shared_numbers,
       count(*) filter (where members = 2) as with_2,
       count(*) filter (where members = 3) as with_3,
       count(*) filter (where members = 4) as with_4,
       count(*) filter (where members >= 5) as with_5_or_more,
       coalesce(max(members), 0) as most_on_one_number
  from n;

\echo
\echo '== 3. How much of the selling those customers carry (completed bills, last 12 months)'
with n as (
  select mobile, count(*) as members from customer
   where active and not archive and mobile is not null and mobile <> '0000000000' group by mobile),
shared as (
  select c.id from customer c join n on n.mobile = c.mobile and n.members > 1 where c.active and not c.archive)
select count(*) as bills,
       count(*) filter (where s.customer_id in (select id from shared)) as bills_on_shared_numbers,
       round(100.0 * count(*) filter (where s.customer_id in (select id from shared)) / nullif(count(*), 0), 1) as pct_bills,
       round((100.0 * coalesce(sum(s.total) filter (where s.customer_id in (select id from shared)), 0) / nullif(sum(s.total), 0))::numeric, 1) as pct_value
  from sale s
 where s.status = 'COMPLETE' and s.active and not s.archive and s.bill_date >= now() - interval '12 months';

\echo
\echo '== 4. Money held per person on shared numbers (what a household balance would join up)'
with n as (
  select mobile, count(*) as members from customer
   where active and not archive and mobile is not null and mobile <> '0000000000' group by mobile),
people as (
  select c.id, c.mobile from customer c join n on n.mobile = c.mobile and n.members > 1 where c.active and not c.archive),
due as (select customer_id, sum(amount) as bal from customer_due_entry group by customer_id having abs(sum(amount)) > 0.005),
cr  as (select customer_id, sum(amount) as bal from customer_credit_entry group by customer_id having abs(sum(amount)) > 0.005)
select (select count(distinct p.mobile) from people p join due d on d.customer_id = p.id) as shared_numbers_with_dues,
       (select count(*) from (select p.mobile from people p join due d on d.customer_id = p.id group by p.mobile having count(*) > 1) x) as of_which_dues_on_2plus_people,
       (select coalesce(round(sum(d.bal)::numeric, 2), 0) from people p join due d on d.customer_id = p.id) as dues_on_shared_numbers,
       (select count(distinct p.mobile) from people p join cr c on c.customer_id = p.id) as shared_numbers_with_store_credit,
       (select count(*) from (select p.mobile from people p join cr c on c.customer_id = p.id group by p.mobile having count(*) > 1) x) as of_which_credit_on_2plus_people,
       (select coalesce(round(sum(c.bal)::numeric, 2), 0) from people p join cr c on c.customer_id = p.id) as store_credit_on_shared_numbers;

\echo
\echo '== 5. Shared numbers whose people disagree about contact (the household would hold one answer)'
with n as (
  select mobile, count(*) as members from customer
   where active and not archive and mobile is not null and mobile <> '0000000000' group by mobile having count(*) > 1)
select count(*) as shared_numbers,
       count(*) filter (where dnc > 1) as disagree_on_do_not_contact,
       count(*) filter (where chans > 1) as disagree_on_channel,
       count(*) filter (where langs > 1) as disagree_on_language,
       count(*) filter (where cons > 1) as disagree_on_consent
  from (select c.mobile,
               count(distinct coalesce(c.do_not_contact, false)) as dnc,
               count(distinct coalesce(c.preferred_channel, '')) as chans,
               count(distinct coalesce(c.message_language, '')) as langs,
               count(distinct (c.contact_consent is not null)) as cons
          from customer c join n on n.mobile = c.mobile where c.active and not c.archive group by c.mobile) x;

\echo
\echo '== 6. Family, or the same person entered twice? (a rough guess: the names on a shared number start with the same word)'
with n as (
  select mobile from customer where active and not archive and mobile is not null and mobile <> '0000000000' group by mobile having count(*) > 1),
f as (
  select c.mobile, count(*) as members, count(distinct lower(split_part(btrim(c.name), ' ', 1))) as first_names
    from customer c join n on n.mobile = c.mobile where c.active and not c.archive group by c.mobile)
select count(*) as shared_numbers,
       count(*) filter (where first_names = members) as all_first_names_differ_likely_family,
       count(*) filter (where first_names < members) as some_first_names_repeat_likely_same_person_twice
  from f;

\echo
\echo '== 7. Alternate mobile of one customer that is the mobile of another (a link the system does not know about)'
select count(*) as customers_with_alt_matching_another
  from customer a
 where a.active and not a.archive and a.alt_mobile is not null
   and exists (select 1 from customer b where b.active and not b.archive and b.mobile = a.alt_mobile and b.id <> a.id);

\echo
\echo '== 8. Refill follow-ups sitting on people of shared numbers'
with n as (
  select mobile, count(*) as members from customer
   where active and not archive and mobile is not null and mobile <> '0000000000' group by mobile having count(*) > 1)
select count(*) as followups_on_shared_numbers
  from refill_followup r join customer c on c.id = r.customer_id join n on n.mobile = c.mobile
 where c.active and not c.archive;

\if :{?detail}
\else
\set detail 0
\endif
\if :detail
\echo
\echo '== Sample: the 15 most shared numbers (last 4 digits only)'
select '******' || right(c.mobile, 4) as number, count(*) as people, min(c.created_on)::date as first_added, max(c.created_on)::date as last_added
  from customer c where c.active and not c.archive and c.mobile is not null and c.mobile <> '0000000000'
 group by c.mobile having count(*) > 1 order by count(*) desc, c.mobile limit 15;
\endif

rollback;
