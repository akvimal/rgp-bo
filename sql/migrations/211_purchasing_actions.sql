-- 211: the sensitive purchasing actions get their own actions on the `purchases` permission (MENU_AND_PERMISSIONS step D, Purchasing).
--   payments.view, payments.record, payments.reverse, returns.manage, invoices.editcompleted, invoices.approvepay, invoices.recalculate
-- Nobody loses what they can do today:
--   payments.view     every role holding purchases read (the payments of an invoice were read with it)
--   payments.record   every role holding purchases add or edit (recording was a POST, changing a payment a PUT)
--   returns.manage    every role holding purchases add or delete (a vendor return was a POST, taking a credit off a DELETE)
--   payments.reverse  the owner roles and the Store Head only (it was a POST, so any role with add could; this narrows it, by decision)
--   invoices.editcompleted, invoices.approvepay, invoices.recalculate   the owner roles (they were owner-only by name)
-- Putting an invoice on hold and releasing it were never owner-only and stay as they are (add).
-- Rollback: 211_rollback.sql.
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'purchases' THEN
      jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || (
        SELECT coalesce(jsonb_agg(jsonb_build_object('action', a)), '[]'::jsonb)
        FROM unnest(ARRAY['payments.view', 'payments.record', 'payments.reverse', 'returns.manage', 'invoices.editcompleted', 'invoices.approvepay', 'invoices.recalculate']) AS a
        WHERE NOT coalesce(e->'policies', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('action', a))
          AND (
            r.name IN ('Business Head', 'Owner-operator')
            OR (a = 'payments.view'   AND coalesce(e->'policies', '[]'::jsonb) @> '[{"action":"read"}]'::jsonb)
            OR (a = 'payments.record' AND (coalesce(e->'policies', '[]'::jsonb) @> '[{"action":"add"}]'::jsonb OR coalesce(e->'policies', '[]'::jsonb) @> '[{"action":"edit"}]'::jsonb))
            OR (a = 'returns.manage'  AND (coalesce(e->'policies', '[]'::jsonb) @> '[{"action":"add"}]'::jsonb OR coalesce(e->'policies', '[]'::jsonb) @> '[{"action":"delete"}]'::jsonb))
            OR (a = 'payments.reverse' AND r.name = 'Store Head')
          )
      ))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "purchases")');
