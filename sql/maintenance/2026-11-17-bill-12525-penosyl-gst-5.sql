-- One-off: sale bill no. 12525 of 3 Nov 2026 billed PENOSYL 2MG TAB 10'S (batch ST24534, 20 units at 3.20) at 12% GST; the right rate is 5%.
--
-- On this system the price on a line is before GST: the line total is  qty x price x (1 + GST/100)  (the till does exactly this). So changing the rate
-- changes the amounts, and this script does all of it:
--   1. sale_item.tax_pcnt            12 -> 5
--   2. sale_item.total               recomputed:  round(qty x price x 1.05, 2)
--   3. sale.total                    moved by the same difference (the bill's total follows its lines)
--   4. sale.cash_amount              moved by the same difference, but only for a bill paid wholly in cash, so what was taken still equals the bill
-- If the line was in fact already charged at 5% (its total already equals qty x price x 1.05, as on the report you checked: 20 x 3.20 x 1.05 = 67.20), the
-- difference is nil and only the rate on the line changes: the totals are left exactly as they are.
--
-- It stops (raises an error, nothing is changed) unless:
--   * exactly one completed bill 12525 exists on 2026-11-03 (bill numbers restart every year and can repeat across stores, so the date is part of the key);
--   * it has exactly one active PENOSYL 2MG TAB line (any pack text after the name, e.g. 10'S) in batch ST24534 with 20 units, and that line is at 12%;
--   * GST for November 2026 has not been closed (filed) for that bill's business (reopen the month in the app first, fix, close it again);
--   * if the amounts would change: the bill is paid wholly in cash (no UPI/card, credit, staff credit or dues), so the payment can follow the total;
--   * the bill's total still equals its lines before this change (the lines' total less the bill discount, to the rupee), so the difference is the only thing moving.
--
-- A change in the amounts also changes the cash the shift should have in the drawer: if the difference is not nil, tell whoever closed that shift.
--
-- Run it in psql. It ends in ROLLBACK, so the first run only shows what it would do. Check the output, then change the last line to COMMIT and run it again.
--   psql -U <user> -d <database> -f 2026-11-17-bill-12525-penosyl-gst-5.sql
--
-- To undo after a COMMIT: the script prints the line id, the old line total, the old bill total and the old cash amount; put them back with
--   update sale_item set tax_pcnt = 12, total = <old line total> where id = <line id>;
--   update sale set total = <old bill total>, cash_amount = <old cash amount> where id = <sale id>;

\set ON_ERROR_STOP on
BEGIN;

\echo '--- the bill (expect exactly one row)'
SELECT s.id AS sale_id, s.bill_no, s.bill_date::date AS bill_date, s.status, s.store_id, st.location AS store, s.total, s.disc_amount, s.cash_amount, s.digi_amount,
       s.credit_amount, s.staff_credit_amount, s.due_amount, s.gst_invoice_no
  FROM sale s LEFT JOIN stores st ON st.id = s.store_id
 WHERE s.bill_no = 12525 AND s.bill_date >= date '2026-11-03' AND s.bill_date < date '2026-11-04' AND s.active AND NOT s.archive;

\echo '--- its lines (the PENOSYL line should show 12; total_at_5 is what it comes to at 5 percent)'
SELECT si.id AS line_id, p.title, si.batch, si.qty, si.price, si.tax_pcnt, si.total, round((si.qty * si.price * 1.05)::numeric, 2) AS total_at_5
  FROM sale_item si JOIN product p ON p.id = si.product_id JOIN sale s ON s.id = si.sale_id
 WHERE s.bill_no = 12525 AND s.bill_date >= date '2026-11-03' AND s.bill_date < date '2026-11-04' AND s.active AND NOT s.archive
   AND si.active AND NOT si.archive
 ORDER BY si.id;

\echo '--- the change'
DO $$
DECLARE
  v_bills int; v_lines int; v_sid int; v_lid int; v_biz int; v_closed int;
  v_rate numeric; v_qty numeric; v_price numeric; v_old_total numeric; v_new_total numeric; v_delta numeric;
  v_sale_total numeric; v_disc numeric; v_cash numeric; v_other numeric; v_lines_total numeric;
BEGIN
  SELECT count(*), max(id) INTO v_bills, v_sid
    FROM sale WHERE bill_no = 12525 AND bill_date >= date '2026-11-03' AND bill_date < date '2026-11-04' AND active AND NOT archive AND status = 'COMPLETE';
  IF v_bills <> 1 THEN RAISE EXCEPTION 'Expected exactly one completed bill 12525 on 2026-11-03, found %. Nothing changed.', v_bills; END IF;

  SELECT count(*), max(si.id) INTO v_lines, v_lid
    FROM sale_item si JOIN product p ON p.id = si.product_id
   WHERE si.sale_id = v_sid AND si.active AND NOT si.archive AND upper(btrim(p.title)) LIKE 'PENOSYL 2MG TAB%' AND upper(btrim(si.batch)) = 'ST24534' AND si.qty = 20;
  IF v_lines <> 1 THEN RAISE EXCEPTION 'Expected exactly one PENOSYL 2MG TAB line (batch ST24534, 20 units) on bill 12525, found %. Nothing changed.', v_lines; END IF;

  SELECT tax_pcnt, qty, price, total INTO v_rate, v_qty, v_price, v_old_total FROM sale_item WHERE id = v_lid;
  IF v_rate IS DISTINCT FROM 12 THEN RAISE EXCEPTION 'The PENOSYL line is at % percent, not 12, so it is not the line this fix expects. Nothing changed.', v_rate; END IF;

  SELECT coalesce(s.gst_business_id, st.business_id) INTO v_biz FROM sale s LEFT JOIN stores st ON st.id = s.store_id WHERE s.id = v_sid;
  SELECT count(*) INTO v_closed FROM gst_filing_month WHERE business_id = v_biz AND month = '2026-11' AND status = 'CLOSED';
  IF v_closed > 0 THEN RAISE EXCEPTION 'GST for 2026-11 is closed for this business. Reopen the month in the app (GST filing), run this, then close it again. Nothing changed.'; END IF;

  -- what the line comes to at 5 percent, and how that differs from what is stored
  v_new_total := round((v_qty * v_price * 1.05)::numeric, 2);
  v_delta := round((v_new_total - v_old_total)::numeric, 2);

  SELECT total, coalesce(disc_amount, 0), coalesce(cash_amount, 0),
         coalesce(digi_amount, 0) + coalesce(credit_amount, 0) + coalesce(staff_credit_amount, 0) + coalesce(due_amount, 0)
    INTO v_sale_total, v_disc, v_cash, v_other FROM sale WHERE id = v_sid;
  SELECT coalesce(sum(total), 0) INTO v_lines_total FROM sale_item WHERE sale_id = v_sid AND active AND NOT archive AND qty > 0;
  IF abs((v_lines_total - v_disc) - v_sale_total) > 1 THEN
    RAISE EXCEPTION 'The bill total % does not equal its lines % less the discount %. Look at the bill by hand. Nothing changed.', v_sale_total, v_lines_total, v_disc;
  END IF;

  IF v_delta <> 0 THEN
    IF v_other <> 0 THEN
      RAISE EXCEPTION 'The amounts would change by % but the bill was not paid wholly in cash (UPI/card, credit or dues are on it), so the payment cannot simply follow. Nothing changed.', v_delta;
    END IF;
    RAISE NOTICE 'The line total moves from % to % (difference %): the bill total and the cash taken follow. The expected cash of the shift moves with it: tell whoever closed that shift.', v_old_total, v_new_total, v_delta;
  ELSE
    RAISE NOTICE 'The line already comes to % at 5 percent: only the GST rate on the line is changed; the totals stay as they are.', v_new_total;
  END IF;

  UPDATE sale_item SET tax_pcnt = 5, total = v_new_total, updated_on = now() WHERE id = v_lid;
  IF v_delta <> 0 THEN
    UPDATE sale SET total = v_sale_total + v_delta, cash_amount = v_cash + v_delta, updated_on = now() WHERE id = v_sid;
  END IF;

  INSERT INTO audit_event (user_id, action, entity_type, entity_id, summary, details, status)
  VALUES (NULL, 'sale.gst_rate_corrected', 'sale', v_sid::text,
          'Bill 12525 (2026-11-03): PENOSYL 2MG TAB GST corrected from 12% to 5% (data fix script)',
          jsonb_build_object('sale_id', v_sid, 'sale_item_id', v_lid, 'rate_from', 12, 'rate_to', 5, 'line_total_from', v_old_total, 'line_total_to', v_new_total,
                             'bill_total_from', v_sale_total, 'bill_total_to', v_sale_total + v_delta, 'cash_from', v_cash, 'cash_to', v_cash + v_delta), 200);

  RAISE NOTICE 'Done: sale % line % set to 5 percent. Old line total %, old bill total %, old cash amount % (kept here in case you need to undo).', v_sid, v_lid, v_old_total, v_sale_total, v_cash;
END $$;

\echo '--- after (the PENOSYL line should now show 5)'
SELECT s.id AS sale_id, s.total AS bill_total, s.cash_amount, s.disc_amount FROM sale s
 WHERE s.bill_no = 12525 AND s.bill_date >= date '2026-11-03' AND s.bill_date < date '2026-11-04' AND s.active AND NOT s.archive;
SELECT si.id AS line_id, p.title, si.batch, si.qty, si.price, si.tax_pcnt, si.total
  FROM sale_item si JOIN product p ON p.id = si.product_id JOIN sale s ON s.id = si.sale_id
 WHERE s.bill_no = 12525 AND s.bill_date >= date '2026-11-03' AND s.bill_date < date '2026-11-04' AND s.active AND NOT s.archive
   AND si.active AND NOT si.archive
 ORDER BY si.id;

ROLLBACK;   -- change to COMMIT once the numbers above look right
