-- 201: one classified stream of money events for the financial dashboard (docs/planning/DASHBOARD_FINANCE_HEALTH.md section 2).
--   flow_category  maps a source category (an expense category) to a class and group; changed by the owner, audited by the app
--   money_flow     read-only view over sales lines, sale returns, purchase lines and approved expenses (accrual-style dates)
-- Sales and purchases are shown net of GST. Transfers (cash to bank, vault, float) are not in the view, so they can never count as income or cost.
-- Bank lines are not in the view yet: most of them repeat a sale, purchase or expense already here.
CREATE TABLE IF NOT EXISTS public.flow_category (
  id          serial PRIMARY KEY,
  source      varchar(12) NOT NULL,
  source_key  varchar(80) NOT NULL,
  flow_class  varchar(20) NOT NULL,
  grp         varchar(40) NOT NULL,
  updated_by  int4,
  updated_on  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flow_category_uq UNIQUE (source, source_key),
  CONSTRAINT flow_category_class_chk CHECK (flow_class IN ('OPERATING_COST', 'FINANCE_COST', 'PEOPLE', 'CAPITAL_OWNER'))
);

-- every expense category the business has today, in the class that fits its cost group
INSERT INTO public.flow_category (source, source_key, flow_class, grp)
SELECT 'EXPENSE', c.name,
       CASE WHEN c.cost_group = 'People' THEN 'PEOPLE' ELSE 'OPERATING_COST' END,
       c.cost_group
  FROM public.expense_category c
ON CONFLICT (source, source_key) DO NOTHING;

CREATE OR REPLACE VIEW public.money_flow AS
  -- sales by product category, net of GST
  SELECT s.bill_date::date AS flow_date, s.store_id, 'INCOME'::text AS flow_class, 'Sales'::text AS grp,
         coalesce(nullif(btrim(p.category), ''), 'Unclassified')::text AS category,
         round((si.total / (1 + coalesce(si.tax_pcnt, p.tax_pcnt, 0) / 100.0))::numeric, 2) AS amount,
         round((si.total - si.total / (1 + coalesce(si.tax_pcnt, p.tax_pcnt, 0) / 100.0))::numeric, 2) AS gst,
         'SALE'::text AS source, si.id AS source_id, (nullif(btrim(p.category), '') IS NULL) AS unclassified
    FROM public.sale s
    JOIN public.sale_item si ON si.sale_id = s.id AND si.active AND NOT si.archive AND coalesce(si.sale_mode, 'SALE') = 'SALE'
    JOIN public.product p ON p.id = si.product_id
   WHERE s.status = 'COMPLETE' AND s.active AND NOT s.archive
  UNION ALL
  -- returns settled in cash or credit, net of GST
  SELECT (ri.settled_on AT TIME ZONE 'Asia/Kolkata')::date, s.store_id, 'INCOME_REDUCTION', 'Returns',
         coalesce(nullif(btrim(p.category), ''), 'Unclassified'),
         round((coalesce(ri.refund_amount, si.total / nullif(si.qty, 0) * coalesce(ri.accepted_qty, ri.qty)) / (1 + coalesce(si.tax_pcnt, p.tax_pcnt, 0) / 100.0))::numeric, 2),
         round((coalesce(ri.refund_amount, si.total / nullif(si.qty, 0) * coalesce(ri.accepted_qty, ri.qty)) * (1 - 1 / (1 + coalesce(si.tax_pcnt, p.tax_pcnt, 0) / 100.0)))::numeric, 2),
         'RETURN', ri.id, (nullif(btrim(p.category), '') IS NULL)
    FROM public.sale_return_item ri
    JOIN public.sale_item si ON si.id = ri.sale_item_id
    JOIN public.sale s ON s.id = si.sale_id
    JOIN public.product p ON p.id = si.product_id
   WHERE upper(ri.status) = 'ADJUSTED' AND ri.settled_on IS NOT NULL AND ri.active AND NOT ri.archive
  UNION ALL
  -- purchases by product category: the line total is before tax
  SELECT pi.invoice_date, pi.store_id, 'COST_OF_GOODS', 'Purchases',
         coalesce(nullif(btrim(p.category), ''), 'Unclassified'),
         round(coalesce(pii.total, 0)::numeric, 2),
         round((coalesce(pii.total, 0) * coalesce(pii.tax_pcnt, 0) / 100.0)::numeric, 2),
         'PURCHASE', pii.id, (nullif(btrim(p.category), '') IS NULL)
    FROM public.purchase_invoice pi
    JOIN public.purchase_invoice_item pii ON pii.invoice_id = pi.id AND pii.active AND NOT pii.archive AND pii.status NOT IN ('DISPUTED', 'REJECTED')
    JOIN public.product p ON p.id = pii.product_id
   WHERE pi.active AND NOT pi.archive AND pi.status = 'COMPLETE'
  UNION ALL
  -- approved expenses; a category with no mapping row is Unclassified
  SELECT e.expense_date, e.store_id, coalesce(m.flow_class, 'UNCLASSIFIED'), coalesce(m.grp, 'Unclassified'), c.name,
         round((e.amount - e.gst_amount)::numeric, 2), round(e.gst_amount::numeric, 2),
         'EXPENSE', e.id, (m.id IS NULL)
    FROM public.expense e
    JOIN public.expense_category c ON c.id = e.category_id
    LEFT JOIN public.flow_category m ON m.source = 'EXPENSE' AND m.source_key = c.name
   WHERE e.status = 'APPROVED';

CREATE INDEX IF NOT EXISTS sale_bill_date_idx ON public.sale (bill_date);
CREATE INDEX IF NOT EXISTS purchase_invoice_date_idx ON public.purchase_invoice (invoice_date);
