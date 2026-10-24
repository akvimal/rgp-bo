/**
 * The stock checks the alerts watch. One query for the book balance of every batch (bought, less sold, plus approved adjustments), with
 * relative imports only so the alert code stays testable.
 */
export const BATCH_BALANCE_SQL = `
with sold as (
  select purchase_item_id, sum(qty) as q from sale_item where status = 'Complete' and active and not archive group by 1
), adj as (
  select item_id, sum(qty) as q from product_qtychange where coalesce(status, 'APPROVED') = 'APPROVED' and active and not archive group by 1
)
select pii.id as item_id, pii.product_id, pii.exp_date,
       ((pii.qty + coalesce(pii.free_qty, 0)) * p.pack) - coalesce(s.q, 0) + coalesce(a.q, 0) as bal,
       (pii.ptr_cost / nullif(p.pack, 0)) as unit_cost
  from purchase_invoice_item pii
  join purchase_invoice pi on pi.id = pii.invoice_id and pi.status = 'COMPLETE' and pi.active and not pi.archive
  join product p on p.id = pii.product_id and p.active and p.pack > 0
  left join sold s on s.purchase_item_id = pii.id
  left join adj a on a.item_id = pii.id
 where pii.active and not pii.archive`;
