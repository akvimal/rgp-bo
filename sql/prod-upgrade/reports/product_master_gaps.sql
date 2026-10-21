-- Active products missing category, HSN or tax %, biggest sellers first (last 12 months).
select p.id as product_id, p.title, coalesce(p.mfr, '') as manufacturer, coalesce(p.category, '') as category,
       coalesce(p.hsn_code, '') as hsn_code, coalesce(p.tax_pcnt::text, '') as tax_pcnt,
       coalesce(r.revenue, 0) as revenue_last_12_months, coalesce(r.units, 0) as units_last_12_months
  from product p
  left join (select si.product_id, round(sum(si.total)::numeric) as revenue, sum(si.qty) as units
               from sale_item si join sale s on s.id = si.sale_id
              where s.status = 'COMPLETE' and s.bill_date >= current_date - 365 group by 1) r on r.product_id = p.id
 where p.active and not p.archive
   and (coalesce(trim(p.category), '') = '' or coalesce(trim(p.hsn_code), '') = '' or p.tax_pcnt is null)
 order by revenue_last_12_months desc, p.title
