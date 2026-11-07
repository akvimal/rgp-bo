-- 168: a to-do can need proof, and a completed one keeps what was attached.
--   needs_proof  : set by the person who gives the to-do (and copied from a repeat to each to-do it makes): it cannot be ticked until the person
--                  adds a comment or at least one photo / file.
--   done_files   : what was attached when it was ticked, [{ "path": "...", "name": "..." }] (files live in the upload folder under todo/<id>).
ALTER TABLE public.todo_template ADD COLUMN IF NOT EXISTS needs_proof boolean NOT NULL DEFAULT false;
ALTER TABLE public.todo_item ADD COLUMN IF NOT EXISTS needs_proof boolean NOT NULL DEFAULT false;
ALTER TABLE public.todo_item ADD COLUMN IF NOT EXISTS done_files jsonb NULL;
