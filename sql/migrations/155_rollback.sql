-- rollback of 155
UPDATE public.app_role
SET permissions = COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'todos'), '[]'::jsonb)::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "todos")');
ALTER TABLE public.notification DROP COLUMN IF EXISTS audience;
DROP TABLE IF EXISTS public.todo_item;
DROP TABLE IF EXISTS public.todo_template;
