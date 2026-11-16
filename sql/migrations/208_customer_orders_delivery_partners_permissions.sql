-- 208: two pages that borrowed another permission get their own (MENU_AND_PERMISSIONS step A).
--  * customerorders: Customer orders (advance-paid commitments) was opened by `sales`. `view` is what the till did before (see, take, collect);
--    `manage` is what only a Store Head or owner could do (pay an advance back, cancel). Every role holding `sales` keeps the page with `view`.
--  * deliverypartners: Settings > Delivery Partners was opened by `purchases` (and the API let any signed-in user change partners). `manage` goes
--    to the owner roles, the Store Head and any role that can add or edit purchases, so no one who had the page loses it.
-- Rollback: 208_rollback.sql.

-- customer orders: view for every role that holds sales; manage for the owner roles and the Store Head
UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  CASE WHEN name IN ('Business Head', 'Owner-operator', 'Store Head')
    THEN '[{"resource":"customerorders","path":"/secure/commitments","policies":[{"action":"view"},{"action":"manage"}]}]'::jsonb
    ELSE '[{"resource":"customerorders","path":"/secure/commitments","policies":[{"action":"view"}]}]'::jsonb
  END
)::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "sales")')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "customerorders")');

-- delivery partners: manage for the owner roles, the Store Head and roles that add or edit purchases
UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"deliverypartners","path":"/secure/settings/delivery-partners","policies":[{"action":"manage"}]}]'::jsonb
)::json
WHERE NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "deliverypartners")')
  AND (
    name IN ('Business Head', 'Owner-operator', 'Store Head')
    OR jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "purchases").policies[*] ? (@.action == "add" || @.action == "edit")')
  );

-- the settings block lists the settings pages a role may open (the role editor builds it from the resources it saves); add the delivery
-- partners page to it for the roles that just received the resource and already have a settings block
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'settings' AND jsonb_typeof(e->'path') = 'array'
              AND NOT (e->'path') @> '["/secure/settings/delivery-partners"]'::jsonb
         THEN jsonb_set(e, '{path}', (e->'path') || '["/secure/settings/delivery-partners"]'::jsonb)
         ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "deliverypartners")')
  AND jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "settings")');
