-- 121: The Store Head is the store manager: besides running the store it adds, edits and removes the staff of its own stores.
-- The rules that keep this safe are in the application (a manager only touches people who work in their stores, never a manager or an owner,
-- and gives only roles whose permissions they hold themselves). This only gives the role the right on users and the page to use it.
-- It leaves the business-level areas (HR, finance, GST filing, staff credit, roles) with the owner, as before.
UPDATE public.app_role r
   SET permissions = (
     SELECT json_agg(
              CASE WHEN p->>'resource' = 'site' AND NOT (p->'path') @> '"/secure/settings/users"'::jsonb
                   THEN jsonb_set(p, '{path}', (p->'path') || '"/secure/settings/users"'::jsonb)
                   ELSE p END)
       FROM jsonb_array_elements(r.permissions::jsonb) p) ::json
 WHERE r.name = 'Store Head' AND r.permissions IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM json_array_elements(r.permissions) q WHERE q->>'resource' = 'users');

UPDATE public.app_role r
   SET permissions = (r.permissions::jsonb ||
     '[{"resource":"users","path":"/secure/settings/users","policies":[{"action":"read","path":"","properties":["fullname","email","phone","location"]},{"action":"add","path":"/new","properties":["fullname","email","phone","location","role","password","storeids"]},{"action":"edit","path":"/edit","properties":["fullname","email","phone","location","role","storeids"]},{"action":"delete"}]}]'::jsonb)::json
 WHERE r.name = 'Store Head' AND r.permissions IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM json_array_elements(r.permissions) q WHERE q->>'resource' = 'users');
