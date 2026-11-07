ALTER TABLE public.todo_item DROP COLUMN IF EXISTS done_files;
ALTER TABLE public.todo_item DROP COLUMN IF EXISTS needs_proof;
ALTER TABLE public.todo_template DROP COLUMN IF EXISTS needs_proof;
