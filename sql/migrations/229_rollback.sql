-- the two checklists go back to being system tasks (what stores set for them is not restored)
UPDATE public.todo_item SET system_key = 'outage_check' WHERE system_key = 'checklist:outage_readiness';
UPDATE public.todo_item SET system_key = 'monthly_housekeeping' WHERE system_key = 'checklist:monthly_housekeeping';
UPDATE public.todo_template SET system_key = 'outage_check' WHERE system_key = 'checklist:outage_readiness';
UPDATE public.todo_template SET system_key = 'monthly_housekeeping' WHERE system_key = 'checklist:monthly_housekeeping';
-- the to-dos of the other checklists (including those of every shift) go
UPDATE public.todo_template SET active = false, next_due_on = NULL WHERE system_key LIKE 'checklist:%';
UPDATE public.todo_item SET archive = true WHERE system_key LIKE 'checklist:%' AND status = 'OPEN';
DROP TABLE IF EXISTS public.checklist_schedule;
