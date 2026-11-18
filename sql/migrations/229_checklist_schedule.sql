-- 229: any checklist can be scheduled: not scheduled, every shift, daily, weekly (on a weekday) or monthly (on a day), at a time. A schedule makes the checklist's to-do
-- in each store's shared list (daily, weekly, monthly) or when a shift opens (every shift); completing the checklist closes it. A store keeps its own schedule, the owner
-- sets one for every store without its own, and with neither the schedule shipped in code applies (outage readiness weekly, opening and closing daily, monthly
-- housekeeping monthly; a checklist a store adds is not scheduled). The two built-in system tasks that were tied to a checklist (outage_check, monthly_housekeeping) become
-- the schedules of those checklists: what stores set for them is carried over and their to-dos keep going under the new key. Rollback: 229_rollback.sql.
CREATE TABLE IF NOT EXISTS public.checklist_schedule (
  id          serial PRIMARY KEY,
  business_id int4 NOT NULL REFERENCES public.business(id),
  store_id    int4 NULL REFERENCES public.stores(id),           -- null = the business's schedule
  key         varchar(40) NOT NULL,
  cadence     varchar(12) NOT NULL,
  day         int4 NULL,                                         -- weekly: 0 = Sunday ... 6; monthly: day of the month, 0 = the last day
  at_time     varchar(5) NOT NULL DEFAULT '09:00',
  updated_by  int4 NULL REFERENCES public.app_user(id),
  updated_on  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checklist_schedule_cadence_chk CHECK (cadence IN ('NONE', 'EACH_SHIFT', 'DAILY', 'WEEKLY', 'MONTHLY'))
);
CREATE UNIQUE INDEX IF NOT EXISTS checklist_schedule_uq ON public.checklist_schedule (business_id, COALESCE(store_id, 0), key);

-- what stores set for the two built-in tasks
INSERT INTO public.checklist_schedule (business_id, store_id, key, cadence, day, at_time, updated_by)
SELECT s.business_id, s.store_id,
       CASE s.task_key WHEN 'outage_check' THEN 'outage_readiness' ELSE 'monthly_housekeeping' END,
       CASE WHEN s.enabled THEN (CASE s.task_key WHEN 'outage_check' THEN 'WEEKLY' ELSE 'MONTHLY' END) ELSE 'NONE' END,
       s.day, '09:00', s.updated_by
  FROM public.system_task_setting s
 WHERE s.task_key IN ('outage_check', 'monthly_housekeeping')
ON CONFLICT DO NOTHING;
DELETE FROM public.system_task_setting WHERE task_key IN ('outage_check', 'monthly_housekeeping');

-- the repeating to-dos already made keep going under the checklist's key
UPDATE public.todo_template SET system_key = 'checklist:outage_readiness' WHERE system_key = 'outage_check';
UPDATE public.todo_template SET system_key = 'checklist:monthly_housekeeping' WHERE system_key = 'monthly_housekeeping';
UPDATE public.todo_item SET system_key = 'checklist:outage_readiness' WHERE system_key = 'outage_check';
UPDATE public.todo_item SET system_key = 'checklist:monthly_housekeeping' WHERE system_key = 'monthly_housekeeping';
