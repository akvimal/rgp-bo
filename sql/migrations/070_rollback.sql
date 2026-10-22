UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'paymentrecon')::json
WHERE name = 'Sales Staff';
