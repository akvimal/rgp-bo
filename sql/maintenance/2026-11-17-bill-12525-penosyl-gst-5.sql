-- One-off: sale bill no. 12525 of 3 Nov 2026 billed PENOSYL 2MG TAB at 12% GST; the right rate is 5%.
--
-- The GST on a bill is read from the line itself (sale_item.tax_pcnt): the bill print, the GST sales report and register, the HSN summary and any credit
-- note all take the rate from there, and the prices are tax-inclusive, so the amount the customer paid does not change. Only the split of that amount
-- into taxable value and tax changes. So this changes one column on one line, and writes an audit entry.
--
-- It stops (raises an error, nothing is changed) unless:
--   * exactly one completed bill 12525 exists on 2026-11-03 (bill numbers restart every year and can repeat across stores, so the date is part of the key);
--   * it has exactly one active line for PENOSYL 2MG TAB, and that line is at 12%;
--   * GST for November 2026 has not been closed (filed) for that bill's business. If it has, reopen the month in the app first (GST filing),
--     fix, and close it again, so the filed snapshot and the register agree.
--
-- Run it in psql. It ends in ROLLBACK, so the first run only shows what it would do. Check the output, then change the last line to COMMIT and run it again.
--   psql -U <user> -d <database> -f 2026-11-17-bill-12525-penosyl-gst-5.sql
--
-- To undo after a COMMIT: update sale_item set tax_pcnt = 12 where id = <the line id printed below>;

\set ON_ERROR_STOP on
BEGIN;

\echo '--- the bill (expect exactly one row)'
SELECT s.id AS sale_id, s.bill_no, s.bill_date::date AS bill_date, s.status, s.store_id, st.location AS store, s.total, s.gst_invoice_no, s.gst_business_id
  FROM sale s LEFT JOIN stores st ON st.id = s.store_id
 WHERE s.bill_no = 12525 AND s.bill_date >= date '2026-11-03' AND s.bill_date < date '2026-11-04' AND s.active AND NOT s.archive;

\echo '--- its lines (the PENOSYL line should show 12)'
SELECT si.id AS line_id, p.title, si.qty, si.price, si.total, si.tax_pcnt, si.status
  FROM sale_item si JOIN product p ON p.id = si.product_id JOIN sale s ON s.id = si.sale_id
 WHERE s.bill_no = 12525 AND s.bill_date >= date '2026-11-03' AND s.bill_date < date '2026-11-04' AND s.active AND NOT s.archive
   AND si.active AND NOT si.archive
 ORDER BY si.id;

\echo '--- the change'
DO $$
DECLARE
  v_bills int; v_lines int; v_sid int; v_lid int; v_biz int; v_closed int; v_rate numeric; v_tot numeric; v_qty numeric;
BEGIN
  SELECT count(*), max(id) INTO v_bills, v_sid
    FROM sale WHERE bill_no = 12525 AND bill_date >= date '2026-11-03' AND bill_date < date '2026-11-04' AND active AND NOT archive AND status = 'COMPLETE';
  IF v_bills <> 1 THEN RAISE EXCEPTION 'Expected exactly one completed bill 12525 on 2026-11-03, found %. Nothing changed.', v_bills; END IF;

  SELECT count(*), max(si.id) INTO v_lines, v_lid
    FROM sale_item si JOIN product p ON p.id = si.product_id
   WHERE si.sale_id = v_sid AND si.active AND NOT si.archive AND upper(btrim(p.title)) = 'PENOSYL 2MG TAB';
  IF v_lines <> 1 THEN RAISE EXCEPTION 'Expected exactly one PENOSYL 2MG TAB line on bill 12525, found %. Nothing changed.', v_lines; END IF;

  SELECT tax_pcnt, total, qty INTO v_rate, v_tot, v_qty FROM sale_item WHERE id = v_lid;
  IF v_rate IS DISTINCT FROM 12 THEN RAISE EXCEPTION 'The PENOSYL line is at % percent, not 12, so it is not the line this fix expects. Nothing changed.', v_rate; END IF;

  SELECT coalesce(s.gst_business_id, st.business_id) INTO v_biz FROM sale s LEFT JOIN stores st ON st.id = s.store_id WHERE s.id = v_sid;
  SELECT count(*) INTO v_closed FROM gst_filing_month WHERE business_id = v_biz AND month = '2026-11' AND status = 'CLOSED';
  IF v_closed > 0 THEN RAISE EXCEPTION 'GST for 2026-11 is closed for this business. Reopen the month in the app (GST filing), run this, then close it again. Nothing changed.'; END IF;

  UPDATE sale_item SET tax_pcnt = 5, updated_on = now() WHERE id = v_lid;

  INSERT INTO audit_event (user_id, action, entity_type, entity_id, summary, details, status)
  VALUES (NULL, 'sale.gst_rate_corrected', 'sale', v_sid::text,
          'Bill 12525 (2026-11-03): PENOSYL 2MG TAB GST corrected from 12% to 5% (data fix script)',
          jsonb_build_object('sale_id', v_sid, 'sale_item_id', v_lid, 'from', 12, 'to', 5, 'line_total', v_tot, 'qty', v_qty), 200);

  RAISE NOTICE 'Done: sale % line % set to 5 percent (was 12).', v_sid, v_lid;
END $$;

\echo '--- after (the PENOSYL line should now show 5; the bill total is unchanged)'
SELECT si.id AS line_id, p.title, si.qty, si.price, si.total, si.tax_pcnt
  FROM sale_item si JOIN product p ON p.id = si.product_id JOIN sale s ON s.id = si.sale_id
 WHERE s.bill_no = 12525 AND s.bill_date >= date '2026-11-03' AND s.bill_date < date '2026-11-04' AND s.active AND NOT s.archive
   AND si.active AND NOT si.archive
 ORDER BY si.id;

ROLLBACK;   -- change to COMMIT once the numbers above look right
