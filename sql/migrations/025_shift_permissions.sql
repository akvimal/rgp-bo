-- 025_shift_permissions.sql
-- Grant the shift open/close actions so a cashier (Sales Staff) can run the
-- till-side shift lifecycle from the POS. See docs/planning/CASHIER_SHIFT_CLOSE.md.
--
-- Business Head / Store Head already pass the backend check (privileged roles);
-- they still need the policy in their permissions JSON so the front-end buttons
-- show. Sales Staff has no `store` block at all, so one is appended (empty nav
-- path — they use the POS "My Shift" card, not the manager Shifts screen).

-- 1) add shift.open / shift.close to any existing `store` resource block
UPDATE public.app_role
SET permissions = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'resource' = 'store' THEN jsonb_set(
        elem, '{policies}',
          coalesce(elem->'policies', '[]'::jsonb)
          || (CASE WHEN coalesce(elem->'policies', '[]'::jsonb) @> '[{"action":"shift.open"}]'::jsonb
                   THEN '[]'::jsonb ELSE '[{"action":"shift.open"}]'::jsonb END)
          || (CASE WHEN coalesce(elem->'policies', '[]'::jsonb) @> '[{"action":"shift.close"}]'::jsonb
                   THEN '[]'::jsonb ELSE '[{"action":"shift.close"}]'::jsonb END)
      )
      ELSE elem
    END
  )::json
  FROM jsonb_array_elements(permissions::jsonb) elem
)
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "store")');

-- 2) roles with no `store` block get one with just the shift actions
--    (empty string path -> the actions authorize but no nav route; they use the
--    POS "My Shift" card, not the manager Shifts screen)
UPDATE public.app_role
SET permissions = (
  permissions::jsonb || '[{"resource":"store","path":[],"policies":[{"action":"shift.open"},{"action":"shift.close"}]}]'::jsonb
)::json
WHERE name = 'Sales Staff'
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "store")');
