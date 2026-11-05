-- 155: to-do list with reminders. A to-do belongs to a person or to a store's pool (any login at that store may tick it); a manager can give one
-- to others. A repeat is a template that makes the next to-do when it is time. Reminders are alerts (kind todo_due): a notification may now carry its
-- own audience, so one person (or a store's staff) is told, not the whole rule's recipients.
CREATE TABLE IF NOT EXISTS public.todo_template (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL REFERENCES public.business(id),
    store_id int4 NULL REFERENCES public.stores(id),
    kind varchar(12) NOT NULL DEFAULT 'TASK',
    title varchar(200) NOT NULL,
    notes text NULL,
    priority varchar(8) NOT NULL DEFAULT 'normal',
    assignee_user_id int4 NULL REFERENCES public.app_user(id),
    pool bool NOT NULL DEFAULT false,
    assigned_by int4 NULL REFERENCES public.app_user(id),
    repeat varchar(24) NOT NULL,
    repeat_days int4[] NULL,                  -- WEEKLY: weekdays, 0 = Sunday ... 6 = Saturday
    repeat_day int4 NULL,                     -- MONTHLY: day of the month, 0 = the last day
    repeat_every int4 NULL,                   -- EVERY_N_DAYS_AFTER_DONE: N
    at_time varchar(5) NOT NULL DEFAULT '09:00',
    starts_on date NOT NULL,
    ends_on date NULL,
    skip_if_open bool NOT NULL DEFAULT true,  -- do not make another while the last one is still open
    soon_days int4 NOT NULL DEFAULT 1,        -- the heads-up this many days before it is due
    escalate_days int4 NOT NULL DEFAULT 3,    -- tell the person who gave it (and the store head) after this many days late
    next_due_on date NULL,
    missed int4 NOT NULL DEFAULT 0,           -- occurrences not made because the last was still open
    active bool NOT NULL DEFAULT true,
    created_by int4 NULL REFERENCES public.app_user(id),
    created_on timestamptz NOT NULL DEFAULT now(),
    archive bool NOT NULL DEFAULT false,
    CONSTRAINT todo_template_repeat_chk CHECK (repeat IN ('DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY', 'EVERY_N_DAYS_AFTER_DONE')),
    CONSTRAINT todo_template_priority_chk CHECK (priority IN ('low', 'normal', 'high')),
    CONSTRAINT todo_template_who_chk CHECK ((pool AND assignee_user_id IS NULL AND store_id IS NOT NULL) OR (NOT pool AND assignee_user_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS todo_template_due_idx ON public.todo_template (next_due_on) WHERE active AND NOT archive;

CREATE TABLE IF NOT EXISTS public.todo_item (
    id bigserial PRIMARY KEY,
    business_id int4 NOT NULL REFERENCES public.business(id),
    store_id int4 NULL REFERENCES public.stores(id),
    template_id int4 NULL REFERENCES public.todo_template(id),
    kind varchar(12) NOT NULL DEFAULT 'TASK',
    title varchar(200) NOT NULL,
    notes text NULL,
    priority varchar(8) NOT NULL DEFAULT 'normal',
    assignee_user_id int4 NULL REFERENCES public.app_user(id),
    pool bool NOT NULL DEFAULT false,
    assigned_by int4 NULL REFERENCES public.app_user(id),
    due_on timestamptz NOT NULL,
    soon_days int4 NOT NULL DEFAULT 1,
    escalate_days int4 NOT NULL DEFAULT 3,
    status varchar(8) NOT NULL DEFAULT 'OPEN',
    completed_by int4 NULL REFERENCES public.app_user(id),
    completed_on timestamptz NULL,
    done_note varchar(300) NULL,
    created_by int4 NULL REFERENCES public.app_user(id),
    created_on timestamptz NOT NULL DEFAULT now(),
    archive bool NOT NULL DEFAULT false,
    CONSTRAINT todo_item_status_chk CHECK (status IN ('OPEN', 'DONE', 'SKIPPED')),
    CONSTRAINT todo_item_priority_chk CHECK (priority IN ('low', 'normal', 'high')),
    CONSTRAINT todo_item_who_chk CHECK ((pool AND assignee_user_id IS NULL AND store_id IS NOT NULL) OR (NOT pool AND assignee_user_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS todo_item_open_idx ON public.todo_item (business_id, due_on) WHERE status = 'OPEN' AND NOT archive;
CREATE INDEX IF NOT EXISTS todo_item_assignee_idx ON public.todo_item (assignee_user_id) WHERE status = 'OPEN' AND NOT archive;
CREATE INDEX IF NOT EXISTS todo_item_template_idx ON public.todo_item (template_id) WHERE template_id IS NOT NULL;

-- a notification may name its own audience (a person, or a store's staff); without one the rule's recipients apply as before
ALTER TABLE public.notification ADD COLUMN IF NOT EXISTS audience jsonb NULL;

-- the page: everyone who works may keep their own to-dos; managers also give them to others
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"todos","path":"/secure/todos","policies":[{"action":"view"},{"action":"add"},{"action":"assign"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator', 'Store Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "todos")');
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"todos","path":"/secure/todos","policies":[{"action":"view"},{"action":"add"}]}]'::jsonb)::json
WHERE name IN ('Sales Staff', 'Counter')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "todos")');
