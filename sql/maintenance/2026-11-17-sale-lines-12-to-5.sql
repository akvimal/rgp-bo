-- One-off: every sale line billed at 12% GST from 1 Nov 2026 becomes 5%, with the line total and the bill total worked out again.
-- (Replaces 2026-11-17-bill-12525-penosyl-gst-5.sql, which fixed one line of one bill; bill 12525 is covered here.)
--
-- On this system the price on a line is before GST: the line total is  qty x price x (1 + GST/100)  (the till does exactly this). For each line at 12%:
--   1. sale_item.tax_pcnt   12 -> 5
--   2. sale_item.total      round(qty x price x 1.05, 2)      (a line that was already charged at 5%, like bill 12525, does not change in amount)
--   3. sale.total           moved by the sum of the changes of its lines (the discount stays as it was)
--   4. sale.cash_amount     moved by the same difference: the customer paid less, so the cash taken falls with it. UPI/card amounts are left alone.
--
-- THIS CHANGES BILLS ALREADY ISSUED, some of them tax invoices. Customers who paid at 12% were charged too much: the difference is theirs to be given back, and
-- the cash drawers of those shifts now hold more than the bills say. The script prints the total difference and the bills by shift date; decide how the money
-- is returned before you commit.
--
-- A bill is left exactly as it is, and listed under "left alone", when any of these is true (a person has to decide what to do with it):
--   * part of it is on credit, staff credit or dues (the customer's account would have to change too);
--   * a credit note or a sale return was made against it;
--   * a line total is not qty x price x 1.12 (or x 1.05 when it was already charged at 5%): it was billed some other way, and a correction of the rate must
--     never raise what a customer was charged;
--   * its total does not equal its lines less the discount (to the rupee), so the difference could not be told apart from the change;
--   * the cash taken is smaller than the reduction (the refund cannot come out of the cash).
-- The script stops (raises an error, nothing is changed) if GST for the month of any bill it would change is closed for its business: reopen the month in the
-- app (GST filing), run this, then close it again, so the filed figures and the register agree.
--
-- Run it in psql. It ends in ROLLBACK, so the first run only shows what it would do. Check the output, then change the last line to COMMIT and run it again.
--   psql -U <user> -d <database> -f 2026-11-17-sale-lines-12-to-5.sql
-- The first date it looks at is below. Lines before it are not touched.
\set from_date '2026-11-01'
--
-- To undo after a COMMIT: the old values are kept in public.maint_gst12to5_backup (one row per line and per bill). Put them back with
--   update sale_item si set tax_pcnt = b.old_tax, total = b.old_total from public.maint_gst12to5_backup b where b.kind = 'LINE' and b.id = si.id;
--   update sale s set total = b.old_total, cash_amount = b.old_cash from public.maint_gst12to5_backup b where b.kind = 'BILL' and b.id = s.id;

\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE IF NOT EXISTS public.maint_gst12to5_backup (
  kind varchar(4) NOT NULL, id int4 NOT NULL, old_tax float8, old_total float8, old_cash float8, done_on timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, id)
);

-- every line at 12% on a completed bill from the date, and what it comes to at 5%
CREATE TEMP TABLE fix_lines ON COMMIT DROP AS
SELECT si.id AS line_id, si.sale_id, si.qty, si.price, si.total AS old_total, round((si.qty * si.price * 1.05)::numeric, 2) AS new_total
  FROM sale_item si JOIN sale s ON s.id = si.sale_id
 WHERE si.active AND NOT si.archive AND si.qty > 0 AND si.tax_pcnt = 12
   AND s.active AND NOT s.archive AND s.status = 'COMPLETE' AND s.bill_date >= :'from_date'::date;

-- one row per bill: what it holds now, what the change comes to, and whether it can be changed safely
CREATE TEMP TABLE fix_bills ON COMMIT DROP AS
SELECT b.*,
       CASE WHEN b.credit_amount + b.staff_credit_amount + b.due_amount <> 0 THEN 'part of it is on credit, staff credit or dues'
            WHEN b.has_return THEN 'a credit note or a return was made against it'
            WHEN b.odd_lines > 0 THEN 'a line total is not price x quantity at 12 or 5 percent, so it was not billed the way this script expects'
            WHEN abs((b.lines_total - b.disc) - b.old_total) > 1 THEN 'the total does not equal its lines less the discount'
            WHEN b.old_cash + b.delta < 0 THEN 'the cash taken is less than the reduction'
       END AS left_alone
  FROM (
    SELECT s.id AS sale_id, s.bill_no, s.bill_date::date AS bill_date, coalesce(s.gst_invoice_no, '') AS invoice_no, s.store_id, st.location AS store,
           coalesce(s.gst_business_id, st.business_id) AS business_id,
           s.total::numeric AS old_total, coalesce(s.disc_amount, 0)::numeric AS disc, coalesce(s.cash_amount, 0)::numeric AS old_cash,
           coalesce(s.credit_amount, 0)::numeric AS credit_amount, coalesce(s.staff_credit_amount, 0)::numeric AS staff_credit_amount, coalesce(s.due_amount, 0)::numeric AS due_amount,
           (SELECT coalesce(sum(x.total), 0)::numeric FROM sale_item x WHERE x.sale_id = s.id AND x.active AND NOT x.archive AND x.qty > 0) AS lines_total,
           (SELECT count(*) FROM fix_lines l WHERE l.sale_id = s.id) AS lines,
           (SELECT coalesce(sum(l.new_total - l.old_total), 0)::numeric FROM fix_lines l WHERE l.sale_id = s.id) AS delta,
           -- a line billed at 12% totals qty x price x 1.12 and one already billed at 5% totals qty x price x 1.05; any other total is something else, and a rate
           -- correction must never raise what a customer was charged
           (SELECT count(*) FROM fix_lines l WHERE l.sale_id = s.id
               AND abs(l.old_total - round((l.qty * l.price * 1.12)::numeric, 2)) > 0.05 AND abs(l.old_total - l.new_total) > 0.05) AS odd_lines,
           (EXISTS (SELECT 1 FROM gst_credit_note cn WHERE cn.sale_id = s.id)
            OR EXISTS (SELECT 1 FROM sale_return_item ri JOIN sale_item x ON x.id = ri.sale_item_id WHERE x.sale_id = s.id)) AS has_return
      FROM sale s LEFT JOIN stores st ON st.id = s.store_id
     WHERE s.id IN (SELECT sale_id FROM fix_lines)
  ) b;

\echo '--- how many'
SELECT (SELECT count(*) FROM fix_lines) AS lines_at_12,
       (SELECT count(*) FROM fix_bills) AS bills,
       (SELECT count(*) FROM fix_bills WHERE left_alone IS NULL) AS bills_to_change,
       (SELECT count(*) FROM fix_bills WHERE left_alone IS NOT NULL) AS bills_left_alone,
       (SELECT coalesce(sum(delta), 0) FROM fix_bills WHERE left_alone IS NULL) AS total_difference;

\echo '--- the bills it would change, by day (difference is what customers were charged too much; negative = less to pay)'
SELECT bill_date, count(*) AS bills, sum(lines) AS lines, sum(delta) AS difference, sum(old_total) AS bills_before, sum(old_total + delta) AS bills_after
  FROM fix_bills WHERE left_alone IS NULL GROUP BY bill_date ORDER BY bill_date;

\echo '--- the first 40 lines it would change'
SELECT b.bill_date, b.store, coalesce(nullif(b.invoice_no, ''), 'bill ' || b.bill_no) AS number, p.title, l.qty, l.price, l.old_total, l.new_total, l.new_total - l.old_total AS difference
  FROM fix_lines l JOIN fix_bills b ON b.sale_id = l.sale_id JOIN sale_item si ON si.id = l.line_id JOIN product p ON p.id = si.product_id
 WHERE b.left_alone IS NULL ORDER BY b.bill_date, b.sale_id, l.line_id LIMIT 40;

\echo '--- left alone: someone has to decide (nothing about these bills is changed)'
SELECT bill_date, store, coalesce(nullif(invoice_no, ''), 'bill ' || bill_no) AS number, old_total AS total, delta AS difference, left_alone AS why
  FROM fix_bills WHERE left_alone IS NOT NULL ORDER BY bill_date, sale_id;

\echo '--- the change'
DO $$
DECLARE v_closed text;
BEGIN
  -- a month that is already filed cannot take a change
  SELECT string_agg(DISTINCT 'business ' || b.business_id || ' month ' || to_char(b.bill_date, 'YYYY-MM'), ', ') INTO v_closed
    FROM fix_bills b JOIN gst_filing_month m ON m.business_id = b.business_id AND m.month = to_char(b.bill_date, 'YYYY-MM') AND m.status = 'CLOSED'
   WHERE b.left_alone IS NULL;
  IF v_closed IS NOT NULL THEN
    RAISE EXCEPTION 'GST is closed for: %. Reopen the month in the app (GST filing), run this, then close it again. Nothing changed.', v_closed;
  END IF;

  -- keep the old values so it can be undone
  INSERT INTO public.maint_gst12to5_backup (kind, id, old_tax, old_total)
    SELECT 'LINE', l.line_id, 12, l.old_total FROM fix_lines l JOIN fix_bills b ON b.sale_id = l.sale_id WHERE b.left_alone IS NULL
  ON CONFLICT (kind, id) DO NOTHING;
  INSERT INTO public.maint_gst12to5_backup (kind, id, old_total, old_cash)
    SELECT 'BILL', b.sale_id, b.old_total, b.old_cash FROM fix_bills b WHERE b.left_alone IS NULL
  ON CONFLICT (kind, id) DO NOTHING;

  UPDATE sale_item si SET tax_pcnt = 5, total = l.new_total, updated_on = now()
    FROM fix_lines l JOIN fix_bills b ON b.sale_id = l.sale_id WHERE si.id = l.line_id AND b.left_alone IS NULL;
  UPDATE sale s SET total = b.old_total + b.delta, cash_amount = b.old_cash + b.delta, updated_on = now()
    FROM fix_bills b WHERE s.id = b.sale_id AND b.left_alone IS NULL AND b.delta <> 0;

  INSERT INTO audit_event (user_id, action, entity_type, entity_id, summary, details, status)
    SELECT NULL, 'sale.gst_rate_corrected', 'sale', b.sale_id::text,
           'Bill ' || coalesce(nullif(b.invoice_no, ''), b.bill_no::text) || ' (' || b.bill_date || '): ' || b.lines || ' line(s) GST corrected from 12% to 5% (data fix script)',
           jsonb_build_object('sale_id', b.sale_id, 'lines', b.lines, 'rate_from', 12, 'rate_to', 5, 'bill_total_from', b.old_total, 'bill_total_to', b.old_total + b.delta, 'cash_from', b.old_cash, 'cash_to', b.old_cash + b.delta), 200
      FROM fix_bills b WHERE b.left_alone IS NULL;

  RAISE NOTICE 'Done: % line(s) on % bill(s) set to 5 percent; the bills come to % less in all; % bill(s) left alone.',
    (SELECT count(*) FROM fix_lines l JOIN fix_bills b ON b.sale_id = l.sale_id WHERE b.left_alone IS NULL),
    (SELECT count(*) FROM fix_bills WHERE left_alone IS NULL),
    (SELECT coalesce(-sum(delta), 0) FROM fix_bills WHERE left_alone IS NULL),
    (SELECT count(*) FROM fix_bills WHERE left_alone IS NOT NULL);
END $$;

\echo '--- after: lines still at 12 percent from the date (only the bills left alone should remain)'
SELECT count(*) AS lines_still_at_12, count(DISTINCT si.sale_id) AS bills
  FROM sale_item si JOIN sale s ON s.id = si.sale_id
 WHERE si.active AND NOT si.archive AND si.qty > 0 AND si.tax_pcnt = 12 AND s.active AND NOT s.archive AND s.status = 'COMPLETE' AND s.bill_date >= :'from_date'::date;

\echo '--- after: every changed bill still equals its lines less the discount (expect 0 rows)'
SELECT s.id, s.bill_no, s.total, sum(si.total) AS lines_total, coalesce(s.disc_amount, 0) AS disc
  FROM sale s JOIN sale_item si ON si.sale_id = s.id AND si.active AND NOT si.archive AND si.qty > 0
 WHERE s.id IN (SELECT sale_id FROM fix_bills WHERE left_alone IS NULL)
 GROUP BY s.id HAVING abs(sum(si.total) - coalesce(s.disc_amount, 0) - s.total) > 1;

ROLLBACK;   -- change to COMMIT once the numbers above look right
