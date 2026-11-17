-- One-off, follow-up to 2026-11-17-sale-lines-12-to-5.sql: the two tax invoices that script left alone because the cash taken on them was smaller than the
-- reduction (they were paid by UPI or card):
--     INV/26-27/000318   (12 Nov 2026)       INV/26-27/000410   (14 Nov 2026)
-- For each line of these bills still at 12% it does what that script does (rate 12 -> 5, line total = qty x price x 1.05, bill total moved by the same
-- difference), but takes the reduction from the UPI/card amount (sale.digi_amount) instead of the cash. The customer is owed the difference: return it
-- through the same UPI/card, and expect the terminal or the statement for that day to show the original amount.
--
-- It stops (raises an error, nothing is changed) unless, for every bill:
--   * the bill exists once, is completed, and has lines still at 12%;
--   * nothing is on credit, staff credit or dues, and no credit note or return was made against it;
--   * every 12% line total is qty x price x 1.12 (or already x 1.05), so the amounts move only downwards;
--   * the bill total equals its lines less the discount (to the rupee);
--   * the UPI/card amount is at least the reduction;
--   * GST for the bill's month is not closed (reopen it in the app first).
-- The old values are kept in public.maint_gst12to5_backup (the same table as the earlier script).
--
-- Run it in psql. It ends in ROLLBACK, so the first run only shows what it would do. Check the output, then change the last line to COMMIT and run it again.
--   psql -U <user> -d <database> -f 2026-11-17-two-bills-12-to-5-from-digital.sql
--
-- To undo after a COMMIT:
--   update sale_item si set tax_pcnt = b.old_tax, total = b.old_total from public.maint_gst12to5_backup b where b.kind = 'LINE' and b.id = si.id and b.id in (<line ids printed below>);
--   update sale s set total = b.old_total, digi_amount = b.old_digi from public.maint_gst12to5_backup b where b.kind = 'BILL' and b.id = s.id and b.id in (<sale ids>);

\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE IF NOT EXISTS public.maint_gst12to5_backup (
  kind varchar(4) NOT NULL, id int4 NOT NULL, old_tax float8, old_total float8, old_cash float8, done_on timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, id)
);
ALTER TABLE public.maint_gst12to5_backup ADD COLUMN IF NOT EXISTS old_digi float8;

CREATE TEMP TABLE fix_bills ON COMMIT DROP AS
SELECT s.id AS sale_id, s.gst_invoice_no AS invoice_no, s.bill_date::date AS bill_date, s.status, s.total::numeric AS old_total, coalesce(s.disc_amount, 0)::numeric AS disc,
       coalesce(s.cash_amount, 0)::numeric AS cash, coalesce(s.digi_amount, 0)::numeric AS old_digi, s.digi_provider, s.digi_refno,
       coalesce(s.credit_amount, 0)::numeric + coalesce(s.staff_credit_amount, 0)::numeric + coalesce(s.due_amount, 0)::numeric AS on_account,
       coalesce(s.gst_business_id, st.business_id) AS business_id
  FROM sale s LEFT JOIN stores st ON st.id = s.store_id
 WHERE s.gst_invoice_no IN ('INV/26-27/000318', 'INV/26-27/000410') AND s.active AND NOT s.archive;

CREATE TEMP TABLE fix_lines ON COMMIT DROP AS
SELECT si.id AS line_id, si.sale_id, si.qty, si.price, si.total::numeric AS old_total, round((si.qty * si.price * 1.05)::numeric, 2) AS new_total
  FROM sale_item si WHERE si.sale_id IN (SELECT sale_id FROM fix_bills) AND si.active AND NOT si.archive AND si.qty > 0 AND si.tax_pcnt = 12;

ALTER TABLE fix_bills ADD COLUMN lines int, ADD COLUMN delta numeric, ADD COLUMN lines_total numeric, ADD COLUMN odd_lines int, ADD COLUMN has_return boolean;
UPDATE fix_bills b SET
  lines = (SELECT count(*) FROM fix_lines l WHERE l.sale_id = b.sale_id),
  delta = (SELECT coalesce(sum(l.new_total - l.old_total), 0) FROM fix_lines l WHERE l.sale_id = b.sale_id),
  lines_total = (SELECT coalesce(sum(x.total), 0)::numeric FROM sale_item x WHERE x.sale_id = b.sale_id AND x.active AND NOT x.archive AND x.qty > 0),
  odd_lines = (SELECT count(*) FROM fix_lines l WHERE l.sale_id = b.sale_id
                 AND abs(l.old_total - round((l.qty * l.price * 1.12)::numeric, 2)) > 0.05 AND abs(l.old_total - l.new_total) > 0.05),
  has_return = (EXISTS (SELECT 1 FROM gst_credit_note cn WHERE cn.sale_id = b.sale_id)
                OR EXISTS (SELECT 1 FROM sale_return_item ri JOIN sale_item x ON x.id = ri.sale_item_id WHERE x.sale_id = b.sale_id));

\echo '--- the two bills as they are now (payment split, and what the change comes to)'
SELECT invoice_no, bill_date, status, old_total AS total, cash, old_digi AS upi_card, digi_provider, digi_refno, on_account, lines AS lines_at_12, delta AS difference FROM fix_bills ORDER BY invoice_no;

\echo '--- their lines at 12 percent'
SELECT b.invoice_no, p.title, l.qty, l.price, l.old_total, l.new_total, l.new_total - l.old_total AS difference
  FROM fix_lines l JOIN fix_bills b ON b.sale_id = l.sale_id JOIN sale_item si ON si.id = l.line_id JOIN product p ON p.id = si.product_id ORDER BY b.invoice_no, l.line_id;

\echo '--- the change'
DO $$
DECLARE r record; v_closed text;
BEGIN
  IF (SELECT count(*) FROM fix_bills) <> 2 THEN RAISE EXCEPTION 'Expected both invoices, found %. Nothing changed.', (SELECT count(*) FROM fix_bills); END IF;
  FOR r IN SELECT * FROM fix_bills ORDER BY invoice_no LOOP
    IF r.status <> 'COMPLETE' THEN RAISE EXCEPTION '% is not a completed bill. Nothing changed.', r.invoice_no; END IF;
    IF r.lines = 0 THEN RAISE EXCEPTION '% has no line at 12 percent (already fixed?). Nothing changed.', r.invoice_no; END IF;
    IF r.on_account <> 0 THEN RAISE EXCEPTION '% has an amount on credit, staff credit or dues. Nothing changed.', r.invoice_no; END IF;
    IF r.has_return THEN RAISE EXCEPTION 'A credit note or a return was made against %. Nothing changed.', r.invoice_no; END IF;
    IF r.odd_lines > 0 THEN RAISE EXCEPTION 'A line total on % is not price x quantity at 12 or 5 percent. Nothing changed.', r.invoice_no; END IF;
    IF abs((r.lines_total - r.disc) - r.old_total) > 1 THEN RAISE EXCEPTION 'The total of % does not equal its lines less the discount. Nothing changed.', r.invoice_no; END IF;
    IF r.delta > 0 THEN RAISE EXCEPTION 'The change would raise the total of %. Nothing changed.', r.invoice_no; END IF;
    IF r.old_digi + r.delta < 0 THEN RAISE EXCEPTION 'The UPI/card amount of % (%) is smaller than the reduction (%). Nothing changed.', r.invoice_no, r.old_digi, -r.delta; END IF;
  END LOOP;

  SELECT string_agg(DISTINCT 'business ' || b.business_id || ' month ' || to_char(b.bill_date, 'YYYY-MM'), ', ') INTO v_closed
    FROM fix_bills b JOIN gst_filing_month m ON m.business_id = b.business_id AND m.month = to_char(b.bill_date, 'YYYY-MM') AND m.status = 'CLOSED';
  IF v_closed IS NOT NULL THEN RAISE EXCEPTION 'GST is closed for: %. Reopen the month in the app (GST filing), run this, then close it again. Nothing changed.', v_closed; END IF;

  INSERT INTO public.maint_gst12to5_backup (kind, id, old_tax, old_total) SELECT 'LINE', line_id, 12, old_total FROM fix_lines ON CONFLICT (kind, id) DO NOTHING;
  INSERT INTO public.maint_gst12to5_backup (kind, id, old_total, old_cash, old_digi) SELECT 'BILL', sale_id, old_total, cash, old_digi FROM fix_bills ON CONFLICT (kind, id) DO NOTHING;

  UPDATE sale_item si SET tax_pcnt = 5, total = l.new_total, updated_on = now() FROM fix_lines l WHERE si.id = l.line_id;
  UPDATE sale s SET total = b.old_total + b.delta, digi_amount = b.old_digi + b.delta, updated_on = now() FROM fix_bills b WHERE s.id = b.sale_id AND b.delta <> 0;

  INSERT INTO audit_event (user_id, action, entity_type, entity_id, summary, details, status)
    SELECT NULL, 'sale.gst_rate_corrected', 'sale', b.sale_id::text,
           'Bill ' || b.invoice_no || ' (' || b.bill_date || '): ' || b.lines || ' line(s) GST corrected from 12% to 5%, the reduction taken from the UPI/card amount (data fix script)',
           jsonb_build_object('sale_id', b.sale_id, 'lines', b.lines, 'rate_from', 12, 'rate_to', 5, 'bill_total_from', b.old_total, 'bill_total_to', b.old_total + b.delta,
                              'digital_from', b.old_digi, 'digital_to', b.old_digi + b.delta), 200
      FROM fix_bills b;

  RAISE NOTICE 'Done: % line(s) on 2 bills set to 5 percent; the customers are owed % in all, to be returned by UPI/card.', (SELECT count(*) FROM fix_lines), (SELECT -sum(delta) FROM fix_bills);
END $$;

\echo '--- after'
SELECT s.gst_invoice_no, s.total, s.cash_amount, s.digi_amount, s.disc_amount FROM sale s WHERE s.id IN (SELECT sale_id FROM fix_bills) ORDER BY s.gst_invoice_no;
SELECT s.gst_invoice_no, p.title, si.qty, si.price, si.tax_pcnt, si.total
  FROM sale_item si JOIN sale s ON s.id = si.sale_id JOIN product p ON p.id = si.product_id
 WHERE s.id IN (SELECT sale_id FROM fix_bills) AND si.active AND NOT si.archive ORDER BY s.gst_invoice_no, si.id;

ROLLBACK;   -- change to COMMIT once the numbers above look right
