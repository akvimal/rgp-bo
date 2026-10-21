-- 052_sales_staff_refills.sql
-- The counter staff are the ones who ring customers about their refills, so give the Sales Staff role the refill list
-- (view) and the contact log (manage). The API limits them to their own stores and hides what a customer typically
-- spends; grievances and the rest of Staff & Quality stay with the managers.

UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"refills","path":"/secure/quality/refills","policies":[{"action":"view"},{"action":"manage"}]}]'::jsonb
)::json
WHERE name = 'Sales Staff'
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "refills")');
