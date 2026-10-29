-- Rollback 111: remove the compliance register and its permission.
DROP TABLE IF EXISTS public.compliance_waiver;
DROP TABLE IF EXISTS public.compliance_event;
DROP TABLE IF EXISTS public.compliance_instance;
UPDATE public.app_role SET permissions = (
  SELECT coalesce(jsonb_agg(elem), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) elem WHERE elem->>'resource' <> 'compliance'
)::json
WHERE name IN ('Business Head', 'Owner-operator', 'Store Head');
