-- 208 rollback: take the two resources off every role again (the pages go back to borrowing sales and purchases), and take the delivery
-- partners page out of the settings block that 208 added it to.
UPDATE public.app_role
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'settings' AND jsonb_typeof(e->'path') = 'array'
         THEN jsonb_set(e, '{path}', (e->'path') - '/secure/settings/delivery-partners')
         ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(permissions::jsonb) e
  WHERE e->>'resource' NOT IN ('customerorders', 'deliverypartners')
)::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "customerorders" || @.resource == "deliverypartners")');
