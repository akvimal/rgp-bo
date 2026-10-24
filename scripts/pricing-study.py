"""
Pricing study, read-only (default_transaction_read_only), against the local copy of production (rgp_rehearsal2 in container rgp-db-dev).
Run: python scripts/pricing-study.py   (edit END/START12/MID below for another window). Prints tables and writes CSVs.
Units: sale_item.price is per unit and EXCLUDES GST; purchase ptr_value is per pack (product.pack units) and excludes GST;
mrp is GST-inclusive. unit cost = ptr_value * (1 - disc%) * qty/(qty+free) / pack.
Output (outside the repo, it holds business margins): D:/workspace/rgp-migration/pricing-study/
"""
import subprocess, csv, io, os, sys

OUT = r'D:\workspace\rgp-migration\pricing-study'
os.makedirs(OUT, exist_ok=True)
END = '2026-10-20'
START12 = '2025-10-20'
MID = '2026-04-20'

BASE = f"""
with L as (
  select si.id, s.bill_date::date d, to_char(s.bill_date, 'YYYY-MM') mon, si.product_id, p.title, p.category,
         nullif(btrim(p.brand), '') brand,
         case when (p.more_props->>'generic') = 'true' then 'generic' when (p.more_props->>'generic') = 'false' then 'not generic' else 'unset' end gflag,
         coalesce((p.more_props->>'chronic') = 'true', false) chronic,
         p.pack, si.qty, si.price, si.price::numeric * si.qty rev, coalesce(si.tax_pcnt, 0)::numeric tax,
         si.mrp_cost::numeric mrp_u,
         case when si.mrp_cost > 0 then greatest(0, 1 - si.price::numeric * (1 + coalesce(si.tax_pcnt, 0)::numeric / 100) / si.mrp_cost::numeric) end disc,
         (pii.ptr_value::numeric * (1 - coalesce(pii.disc_pcnt, 0)::numeric / 100) * pii.qty / nullif(pii.qty + coalesce(pii.free_qty, 0), 0)) / nullif(p.pack, 0) ucost,
         pi.vendor_id
    from sale_item si
    join sale s on s.id = si.sale_id and s.status = 'COMPLETE'
    join product p on p.id = si.product_id
    join purchase_invoice_item pii on pii.id = si.purchase_item_id and pii.ptr_value > 0
    join purchase_invoice pi on pi.id = pii.invoice_id
   where si.status = 'Complete' and si.qty > 0 and si.price > 0 and p.pack > 0
), LC as (
  select *, ucost * qty cost, rev - ucost * qty gp,
         case when mrp_u > 0 then 1 - ucost * (1 + tax / 100) / mrp_u end trade_margin
    from L where ucost > 0
)
"""

def run(name, sql, show=True):
    t = sql.lstrip()
    # a query with its own WITH is chained onto the base CTEs
    full = (BASE.rstrip() + ', ' + t[5:]) if t.lower().startswith('with ') else BASE + sql
    r = subprocess.run(['docker', 'exec', '-e', 'PGOPTIONS=-c default_transaction_read_only=on', 'rgp-db-dev',
                        'psql', '-U', 'rgpapp', '-d', 'rgp_rehearsal2', '--csv', '-c', full],
                       capture_output=True, text=True, encoding='utf-8')
    if r.returncode != 0:
        print('FAILED', name, r.stderr[:600]); sys.exit(1)
    open(os.path.join(OUT, name + '.csv'), 'w', encoding='utf-8', newline='').write(r.stdout)
    rows = list(csv.reader(io.StringIO(r.stdout)))
    if show:
        print(f'\n=== {name} ===')
        w = [max(len(str(c)) for c in col) for col in zip(*rows)]
        for i, row in enumerate(rows[:40]):
            print('  '.join(str(c).ljust(w[j]) if j == 0 else str(c).rjust(w[j]) for j, c in enumerate(row)))
            if i == 0: print('  '.join('-' * x for x in w))
    return rows

W12 = f"d >= date '{START12}' and d < date '{END}'"

run('01_coverage', f"""
select count(*) lines, round(sum(rev)) revenue_ex_tax, round(sum(cost)) cost, round(sum(gp)) gross_profit,
       round(100*sum(gp)/sum(rev), 1) gm_pct, round(100*sum(gp)/sum(cost), 1) markup_pct
  from LC where {W12}""")

run('02_by_month', f"""
select mon, round(sum(rev)) revenue, round(sum(gp)) gp, round(100*sum(gp)/sum(rev),1) gm_pct, round(100*sum(gp)/sum(cost),1) markup_pct,
       round(100*sum(rev*disc)/nullif(sum(rev) filter (where disc is not null),0),1) avg_disc_pct
  from LC where d >= date '2024-10-01' and d < date '{END}' group by 1 order by 1""")

run('03_by_trade_margin_band', f"""
select case when trade_margin is null then 'no mrp' when trade_margin < .10 then '1: <10%' when trade_margin < .20 then '2: 10-20%'
            when trade_margin < .30 then '3: 20-30%' when trade_margin < .50 then '4: 30-50%' when trade_margin < .70 then '5: 50-70%' else '6: 70%+' end as trade_margin_band,
       count(distinct product_id) products, round(sum(rev)) revenue, round(100*sum(rev)/sum(sum(rev)) over (),1) rev_share,
       round(sum(gp)) gp, round(100*sum(gp)/sum(sum(gp)) over (),1) gp_share,
       round(100*sum(rev*disc)/nullif(sum(rev) filter (where disc is not null),0),0) avg_disc_pct,
       round(100*sum(gp)/sum(cost),0) markup_pct
  from LC where {W12} group by 1 order by 1""")

run('04_by_discount_band', f"""
select case when disc is null then 'no mrp' when disc < .02 then '1: at MRP' when disc < .10 then '2: 2-10%' when disc < .20 then '3: 10-20%'
            when disc < .30 then '4: 20-30%' when disc < .40 then '5: 30-40%' when disc < .50 then '6: 40-50%' when disc < .60 then '7: 50-60%'
            when disc < .70 then '8: 60-70%' else '9: 70%+' end as discount_band,
       count(*) lines, count(distinct product_id) products, round(sum(rev)) revenue, round(100*sum(rev)/sum(sum(rev)) over (),1) rev_share,
       round(sum(gp)) gp, round(100*sum(gp)/sum(sum(gp)) over (),1) gp_share, round(100*sum(gp)/sum(cost),0) markup_pct
  from LC where {W12} group by 1 order by 1""")

run('05_by_flags', f"""
select category, gflag generic_flag, case when brand is null then 'no brand' else 'brand' end has_brand, chronic,
       count(distinct product_id) products, round(sum(rev)) revenue, round(100*sum(rev)/sum(sum(rev)) over (),1) rev_share,
       round(100*sum(gp)/sum(sum(gp)) over (),1) gp_share, round(100*sum(rev*disc)/nullif(sum(rev) filter (where disc is not null),0),0) avg_disc_pct,
       round(100*sum(gp)/sum(cost),0) markup_pct
  from LC where {W12} group by 1,2,3,4 order by sum(rev) desc""")

run('06_abc_by_gp', f"""
with P as (select product_id, max(title) title, sum(rev) rev, sum(gp) gp, sum(cost) cost, sum(qty) units, count(*) lines,
                  sum(rev*disc)/nullif(sum(rev) filter (where disc is not null),0) disc, avg(trade_margin) tm
             from LC where {W12} group by 1),
R as (select *, sum(gp) over (order by gp desc, product_id) / sum(gp) over () cum from P where gp > 0)
select case when cum <= .70 then 'A (first 70% of profit)' when cum <= .90 then 'B (next 20%)' else 'C (last 10%)' end abc,
       count(*) products, round(sum(rev)) revenue, round(sum(gp)) gp, round(100*sum(gp)/sum(cost),0) markup_pct,
       round(100*sum(rev*disc)/sum(rev),0) avg_disc_pct, round(100*avg(tm),0) avg_trade_margin_pct, round(avg(lines)) avg_lines
  from R group by 1 order by 1""")

run('07_loss_and_thin', f"""
select case when gp < 0 then '1: sold below cost' when gp/cost < .05 then '2: markup under 5%' when gp/cost < .10 then '3: markup 5-10%' else '4: 10%+' end band,
       count(*) lines, count(distinct product_id) products, round(sum(rev)) revenue, round(sum(gp)) gp
  from LC where {W12} group by 1 order by 1""")

run('08_top_loss_products', f"""
select product_id, title, round(sum(qty)) units, round(sum(rev)) revenue, round(sum(gp)) gp, round(100*sum(gp)/sum(cost),1) markup_pct,
       round(100*sum(rev*disc)/nullif(sum(rev) filter (where disc is not null),0),0) avg_disc_pct
  from LC where {W12} group by 1,2 having sum(gp) < 0 order by sum(gp) limit 25""")

run('09_cost_vs_price_drift', f"""
with H as (select product_id, max(title) title,
       sum(qty) filter (where d < date '{MID}') u1, sum(qty) filter (where d >= date '{MID}') u2,
       sum(cost) filter (where d < date '{MID}') / nullif(sum(qty) filter (where d < date '{MID}'),0) c1,
       sum(cost) filter (where d >= date '{MID}') / nullif(sum(qty) filter (where d >= date '{MID}'),0) c2,
       sum(rev) filter (where d < date '{MID}') / nullif(sum(qty) filter (where d < date '{MID}'),0) p1,
       sum(rev) filter (where d >= date '{MID}') / nullif(sum(qty) filter (where d >= date '{MID}'),0) p2,
       count(*) filter (where d < date '{MID}') n1, count(*) filter (where d >= date '{MID}') n2
  from LC where {W12} group by 1),
D as (select *, (c2/c1 - 1) cost_chg, (p2/p1 - 1) price_chg, greatest(0, (c2 - c1) - (p2 - p1)) * u2 leak from H where n1 >= 5 and n2 >= 5 and c1 > 0 and p1 > 0)
select case when cost_chg > .05 and price_chg < cost_chg/2 then 'cost up over 5%, price did not follow'
            when cost_chg > .05 then 'cost up over 5%, price followed' when cost_chg < -.05 then 'cost down over 5%' else 'cost steady' end drift,
       count(*) products, round(100*avg(cost_chg),1) avg_cost_chg_pct, round(100*avg(price_chg),1) avg_price_chg_pct, round(sum(leak)) margin_leak_per_half_year
  from D group by 1 order by 5 desc nulls last""")

run('10_top_unrecovered_cost_rises', f"""
with H as (select product_id, max(title) title,
       sum(qty) filter (where d >= date '{MID}') u2,
       sum(cost) filter (where d < date '{MID}') / nullif(sum(qty) filter (where d < date '{MID}'),0) c1,
       sum(cost) filter (where d >= date '{MID}') / nullif(sum(qty) filter (where d >= date '{MID}'),0) c2,
       sum(rev) filter (where d < date '{MID}') / nullif(sum(qty) filter (where d < date '{MID}'),0) p1,
       sum(rev) filter (where d >= date '{MID}') / nullif(sum(qty) filter (where d >= date '{MID}'),0) p2,
       count(*) filter (where d < date '{MID}') n1, count(*) filter (where d >= date '{MID}') n2
  from LC where {W12} group by 1)
select product_id, title, round(u2) units_h2, round(c1::numeric,2) unit_cost_h1, round(c2::numeric,2) unit_cost_h2, round(100*(c2/c1-1)) cost_chg_pct,
       round(p1::numeric,2) price_h1, round(p2::numeric,2) price_h2, round(100*(p2/p1-1)) price_chg_pct,
       round((greatest(0,(c2-c1)-(p2-p1))*u2)::numeric) leak_h2
  from H where n1 >= 5 and n2 >= 5 and c1 > 0 and p1 > 0 and c2/c1 > 1.05 and (p2/p1 - 1) < (c2/c1 - 1)/2
 order by (greatest(0,(c2-c1)-(p2-p1))*u2) desc limit 25""")

run('11_top_profit_products', f"""
select product_id, title, round(sum(qty)) units, round(sum(rev)) revenue, round(sum(gp)) gp, round(100*sum(gp)/sum(cost),0) markup_pct,
       round(100*sum(rev*disc)/nullif(sum(rev) filter (where disc is not null),0),0) avg_disc_pct, gflag
  from LC where {W12} group by 1,2,gflag order by sum(gp) desc limit 25""")

run('12_high_volume_thin_margin', f"""
select product_id, title, round(sum(qty)) units, round(sum(rev)) revenue, round(sum(gp)) gp, round(100*sum(gp)/sum(cost),1) markup_pct,
       round(100*sum(rev*disc)/nullif(sum(rev) filter (where disc is not null),0),0) avg_disc_pct
  from LC where {W12} group by 1,2 having sum(rev) > 20000 and sum(gp)/sum(cost) < .15 order by sum(rev) desc limit 25""")

run('13_price_changes', f"""
select 'price rows since 2024-11' k, count(*)::text v from product_price2
union all select 'distinct products ever priced', count(distinct product_id)::text from product_price2
union all select 'rows in last 12 months', count(*)::text from product_price2 where eff_date >= date '{START12}'
union all select 'distinct products repriced in last 12 months', count(distinct product_id)::text from product_price2 where eff_date >= date '{START12}'
union all select 'products sold in last 12 months', count(distinct product_id)::text from LC where {W12}
union all select 'reason: ' || coalesce(reason, '(none)'), count(*)::text from product_price2 where eff_date >= date '{START12}' group by reason""")

run('14_vendor_cost_creep', f"""
with R as (
  select pi.vendor_id, pii.product_id, pi.invoice_date, pii.qty,
         pii.ptr_value::numeric * (1 - coalesce(pii.disc_pcnt,0)::numeric/100) * pii.qty / nullif(pii.qty + coalesce(pii.free_qty,0),0) unit_rate
    from purchase_invoice_item pii join purchase_invoice pi on pi.id = pii.invoice_id
   where pii.ptr_value > 0 and pii.qty > 0 and pi.invoice_date >= date '{START12}' - 120
), S as (
  select *, lag(unit_rate) over (partition by vendor_id, product_id order by invoice_date) prev_rate,
            lag(invoice_date) over (partition by vendor_id, product_id order by invoice_date) prev_date
    from R)
select v.business_name vendor, count(*) repeat_purchases, round(100*avg(unit_rate/prev_rate - 1),1) avg_change_pct,
       round(100*count(*) filter (where unit_rate/prev_rate > 1.005)::numeric/count(*)) pct_rose, round(100*count(*) filter (where unit_rate/prev_rate > 1.05)::numeric/count(*)) pct_rose_over_5,
       round(sum(greatest(0, unit_rate - prev_rate) * qty)) extra_paid
  from S join vendor v on v.id = S.vendor_id
 where prev_rate > 0 and invoice_date >= date '{START12}' and invoice_date > prev_date
 group by 1 having count(*) >= 20 order by sum(greatest(0, unit_rate - prev_rate) * qty) desc limit 15""")


run('15_price_change_sizes', f"""
with C as (select id, product_id, eff_date, sale_price, lag(sale_price) over (partition by product_id order by eff_date, id) prev
             from product_price2 where sale_price > 0),
D as (select *, sale_price/prev - 1 chg from C where prev > 0 and eff_date >= date '{START12}')
select case when chg < -.2 then '1: cut over 20%' when chg < -.1 then '2: cut 10-20%' when chg < -.02 then '3: cut 2-10%' when chg <= .02 then '4: within 2%'
            when chg <= .10 then '5: raise 2-10%' when chg <= .20 then '6: raise 10-20%' else '7: raise over 20%' end band,
       count(*) changes, count(distinct product_id) products
  from D group by 1 order by 1""")

run('16_volume_after_price_change', f"""
with C as (select id, product_id, eff_date, sale_price, lag(sale_price) over (partition by product_id order by eff_date, id) prev
             from product_price2 where sale_price > 0),
E as (select product_id, eff_date, sale_price/prev - 1 chg from C where prev > 0 and eff_date between date '2025-01-01' and date '{END}' - 60 and abs(sale_price/prev - 1) >= .10),
V as (select e.product_id, e.eff_date, e.chg,
        coalesce((select sum(qty)::numeric from LC where LC.product_id = e.product_id and d >= e.eff_date - 60 and d < e.eff_date),0) ub,
        coalesce((select sum(qty)::numeric from LC where LC.product_id = e.product_id and d >= e.eff_date and d < e.eff_date + 60),0) ua
        from E e)
select case when chg < -.2 then '1: cut over 20%' when chg < 0 then '2: cut 10-20%' when chg <= .2 then '3: raise 10-20%' else '4: raise over 20%' end band,
       count(*) filter (where ub >= 20) events_with_volume,
       round((percentile_cont(.5) within group (order by ua/ub) filter (where ub >= 20))::numeric, 2) median_units_after_over_before,
       round(avg(ua/ub) filter (where ub >= 20)::numeric, 2) avg_ratio
  from V group by 1 order by 1""")

run('17_march_2026', f"""
select title, round(sum(qty)) units, round(sum(rev)) rev, round(sum(gp)) gp, round(100*sum(gp)/sum(rev)) gm_pct, round(avg(ucost),2) avg_unit_cost, pack
  from LC where mon = '2026-03' group by title, pack order by sum(gp) - sum(rev)*.5 limit 10""")

run('18_bill_level_discount', f"""
select round(sum(s.total::numeric)) bill_totals, round(sum(s.disc_amount::numeric)) bill_discounts, round(100*sum(s.disc_amount::numeric)/nullif(sum(s.total::numeric),0),2) pct
  from sale s where s.status = 'COMPLETE' and s.bill_date >= date '{START12}' and s.bill_date < date '{END}'""")


for cap in (70, 60, 50):
    for keep in (100, 90, 80):
        run(f'19_cap_{cap}_keep_{keep}', f"""
select {cap} cap_pct, {keep} units_kept_pct, count(*) lines_affected, count(distinct product_id) products_affected,
       round(sum(rev)) revenue_now, round(sum(gp)) gp_now,
       round(sum({keep}/100.0 * qty * (mrp_u * (1 - {cap}/100.0) / (1 + tax/100.0) - ucost))) gp_if_capped,
       round(sum({keep}/100.0 * qty * (mrp_u * (1 - {cap}/100.0) / (1 + tax/100.0) - ucost)) - sum(gp)) gp_change
  from LC where {W12} and disc is not null and disc > {cap}/100.0""", show=False)
import csv as _c
print('\n=== 19_discount_cap_scenarios (gp change over 12 months, ex-tax Rs) ===')
for cap in (70, 60, 50):
    row = []
    for keep in (100, 90, 80):
        r = list(_c.reader(open(os.path.join(OUT, f'19_cap_{cap}_keep_{keep}.csv'), encoding='utf-8')))
        h, d = r[0], r[1]
        row.append(f"keep {keep}%: {int(float(d[h.index('gp_change')])):,}")
    d0 = d
    print(f"cap {cap}% off MRP: lines {d0[2]}, products {d0[3]}, gp now {int(float(d0[5])):,} | " + ' | '.join(row))

print('\nCSV files in', OUT)
