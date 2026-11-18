DROP INDEX IF EXISTS public.todo_item_system_idx;
DROP INDEX IF EXISTS public.todo_template_system_uq;
ALTER TABLE public.todo_item DROP COLUMN IF EXISTS link;
ALTER TABLE public.todo_item DROP COLUMN IF EXISTS system_key;
ALTER TABLE public.todo_template DROP COLUMN IF EXISTS link;
ALTER TABLE public.todo_template DROP COLUMN IF EXISTS system_key;
DROP TABLE IF EXISTS public.system_task_setting;
DROP TABLE IF EXISTS public.checklist_run;
DROP TABLE IF EXISTS public.checklist_template;
UPDATE public.app_role SET permissions = (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'checklists')::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "checklists")');
