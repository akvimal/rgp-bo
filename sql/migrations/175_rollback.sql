-- rollback of 175
UPDATE public.app_role
SET permissions = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'feedback'), '[]'::jsonb)::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "feedback")');
DROP TABLE IF EXISTS public.app_feedback_note;
DROP TABLE IF EXISTS public.app_feedback;
