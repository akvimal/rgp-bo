UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'inquiries')::json
WHERE name IN ('Business Head', 'Store Head', 'Sales Staff');
DROP TABLE IF EXISTS public.customer_inquiry;
