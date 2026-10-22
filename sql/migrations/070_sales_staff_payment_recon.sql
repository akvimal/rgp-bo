-- 070_sales_staff_payment_recon.sql
-- Sales Staff check digital payments against the statement too, for the bills of the stores they work in (the Store Head
-- role already can). The statement upload stays with the Business Head.
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"paymentrecon","path":"/secure/digital-payments","policies":[{"action":"view"},{"action":"verify"}]}]'::jsonb)::json
WHERE name = 'Sales Staff' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "paymentrecon")');
