-- 217: the day-to-day customer routes get actions on the `customers` permission (MENU_AND_PERMISSIONS step E, Customers, second pass).
--   dues.view, dues.collect, audiences.use, worklist.use, consent.manage
-- These routes were open to any signed-in login: who owes, taking a payment, the contact list, the contact log, consent. Every role that already
-- holds the Customers page gets all five, so nobody who uses the page loses anything. A role WITHOUT the Customers page no longer reaches them
-- (the till's credit check still works for any role that can add or bill a sale). Full phone numbers and list downloads keep their own
-- `reveal` and `export` grants. Narrow a role afterwards in the role editor.
-- Rollback: 217_rollback.sql.
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'customers' THEN
      jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || (
        SELECT coalesce(jsonb_agg(jsonb_build_object('action', a)), '[]'::jsonb)
        FROM unnest(ARRAY['dues.view', 'dues.collect', 'audiences.use', 'worklist.use', 'consent.manage']) AS a
        WHERE NOT coalesce(e->'policies', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('action', a))
      ))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "customers")');
