UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'stockaudit')::json
WHERE name IN ('Business Head', 'Store Head');
DROP TABLE IF EXISTS public.stock_audit, public.stock_audit_plan;
