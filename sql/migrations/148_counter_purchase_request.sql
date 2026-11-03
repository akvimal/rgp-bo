-- 148: the Counter login can raise a purchase request from the billing screen ("Request a product we don't have").
-- It gets the `request` action on `purchases` only (create a request), not `read`, so the shared till login still cannot
-- open purchase orders, invoices or vendors. Sales Staff already have this (migration 049).

UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"purchases","path":[],"policies":[{"action":"request"}]}]'::jsonb)::json
WHERE name = 'Counter'
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "purchases")');
