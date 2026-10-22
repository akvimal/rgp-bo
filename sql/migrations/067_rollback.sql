UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' NOT IN ('myhr', 'leaveapprove'))::json
WHERE name IN ('Business Head', 'Store Head', 'Sales Staff');
