-- 047_business_profile_permission.sql
-- Settings > Business details. Only the first business is created by the Site Admin; after that the Business Head
-- keeps their own business's name, legal name, GSTIN, state, address and pincode up to date. The API gate is
-- role-name based; the nav and route guard read the stored permissions JSON, so append a `businessprofile` resource.

UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"businessprofile","path":"/secure/settings/business-profile","policies":[{"action":"manage"}]}]'::jsonb
)::json
WHERE name = 'Business Head'
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "businessprofile")');
