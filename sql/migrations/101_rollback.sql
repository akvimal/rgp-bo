-- rollback of 101_weekly_review.sql
DROP TABLE IF EXISTS public.weekly_review;
UPDATE public.app_role SET permissions = (SELECT COALESCE(json_agg(e), '[]'::json) FROM json_array_elements(permissions) e WHERE e->>'resource' <> 'review')
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "review")');
