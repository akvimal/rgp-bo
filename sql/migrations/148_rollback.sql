-- rollback of 148
UPDATE public.app_role
SET permissions = (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e
                    WHERE NOT (e->>'resource' = 'purchases' AND e->'policies' = '[{"action":"request"}]'::jsonb))::json
WHERE name = 'Counter';
