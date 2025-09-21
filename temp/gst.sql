select s.bill_no, to_char(s.bill_date, 'yyyy-MM-dd') as bill_date, c."name", sum(si.total) as sale_total,
coalesce((si.tax_pcnt/2),0) as cgst_pcnt, round((sum(si.total)*(si.tax_pcnt/2/100))::numeric,2) as cgst_amt,
coalesce((si.tax_pcnt/2),0) as sgst_pcnt, round((sum(si.total)*(si.tax_pcnt/2/100))::numeric,2) as sgst_amt,
(round((sum(si.total)*(si.tax_pcnt/2/100))::numeric,2)+round((sum(si.total)*(si.tax_pcnt/2/100))::numeric,2)) as gst_total
from sale_item si 
inner join sale s on s.id = si.sale_id and s.bill_date between '2025-08-01' and '2025-09-01'
inner join customer c on c.id = s.customer_id 
group by s.bill_no, s.bill_date, c."name", si.tax_pcnt
order by s.bill_no, s.bill_date asc

select round(sum(x.sale_total)) as sale_amt, x.cgst_pcnt, sum(x.cgst_amt) as cgst_amt,x.sgst_pcnt,sum(x.sgst_amt)as sgst_amt, sum(x.gst_total) as totel_gst_amt
from
(select s.bill_no, to_char(s.bill_date, 'yyyy-MM-dd') as bill_date, c."name", sum(si.total) as sale_total,
coalesce((si.tax_pcnt/2),0) as cgst_pcnt, round((sum(si.total)*(si.tax_pcnt/2/100))::numeric,2) as cgst_amt,
coalesce((si.tax_pcnt/2),0) as sgst_pcnt, round((sum(si.total)*(si.tax_pcnt/2/100))::numeric,2) as sgst_amt,
(round((sum(si.total)*(si.tax_pcnt/2/100))::numeric,2)+round((sum(si.total)*(si.tax_pcnt/2/100))::numeric,2)) as gst_total
from sale_item si 
inner join sale s on s.id = si.sale_id and s.bill_date between '2025-08-01' and '2025-09-01'
inner join customer c on c.id = s.customer_id 
group by s.bill_no, s.bill_date, c."name", si.tax_pcnt
order by s.bill_no, s.bill_date asc) x
group by x.cgst_pcnt, x.sgst_pcnt order by cgst_pcnt

select s.bill_no, to_char(s.bill_date, 'yyyy-MM-dd') as bill_date, c."name" , (sri.qty * si.price) as return_total,
(si.tax_pcnt/2) as cgst, round((sum(sri.qty * si.price)*(si.tax_pcnt/2/100))::numeric,2) as cgst_return_amt,
(si.tax_pcnt/2) as sgst, round((sum(sri.qty * si.price)*(si.tax_pcnt/2/100))::numeric,2) as sgst_return_amt, 
(round((sum(sri.qty * si.price)*(si.tax_pcnt/2/100))::numeric,2)+round((sum(sri.qty * si.price)*(si.tax_pcnt/2/100))::numeric,2)) as gst_return_total
from sale_item si 
inner join sale s on s.id = si.sale_id and s.bill_date between '2025-08-01' and '2025-09-01'
inner join customer c on c.id = s.customer_id
inner join sale_return_item sri on sri.sale_item_id = si.id
group by s.bill_no, s.bill_date, c."name", sri.qty, si.price, si.tax_pcnt


select round(sum(x.return_total)) as return_total, x.cgst,sum(x.cgst_return_amt) as cgst_amt,x.sgst,sum(x.sgst_return_amt)as sgst_amt, sum(x.gst_return_total) as totel_gst_amt
from
(select s.bill_no, to_char(s.bill_date, 'yyyy-MM-dd') as bill_date, c."name" , (sri.qty * si.price) as return_total,
(si.tax_pcnt/2) as cgst, round((sum(sri.qty * si.price)*(si.tax_pcnt/2/100))::numeric,2) as cgst_return_amt,
(si.tax_pcnt/2) as sgst, round((sum(sri.qty * si.price)*(si.tax_pcnt/2/100))::numeric,2) as sgst_return_amt, 
(round((sum(sri.qty * si.price)*(si.tax_pcnt/2/100))::numeric,2)+round((sum(sri.qty * si.price)*(si.tax_pcnt/2/100))::numeric,2)) as gst_return_total
from sale_item si 
inner join sale s on s.id = si.sale_id and s.bill_date between '2025-08-01' and '2025-09-01'
inner join customer c on c.id = s.customer_id
inner join sale_return_item sri on sri.sale_item_id = si.id
group by s.bill_no, s.bill_date, c."name", sri.qty, si.price, si.tax_pcnt) x
group by x.cgst, x.sgst order by cgst