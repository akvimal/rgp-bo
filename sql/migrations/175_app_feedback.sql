-- 175: app feedback. A person reports something wrong, asks a question, suggests a feature or flags wrong data, naming the module and feature,
-- and sees the answer in a thread. Managers (feedback.manage) answer. Replies and "waiting for you" are alerts (kinds feedback_reply and
-- feedback_waiting; the engine makes the rules from DEFAULT_RULES, so no alert rows are added here).
CREATE TABLE IF NOT EXISTS public.app_feedback (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL REFERENCES public.business(id),
    store_id int4 NULL REFERENCES public.stores(id),
    kind varchar(12) NOT NULL,
    module_id varchar(60) NULL,                 -- the app guide page id (nav-sales); kept with its title because pages get renamed
    module_title varchar(80) NOT NULL DEFAULT 'Not sure',
    feature varchar(100) NULL,
    title varchar(120) NOT NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb, -- what / expected / goal / benefit, by kind
    impact varchar(12) NULL,                    -- problems and wrong data: blocks, workaround, minor
    files jsonb NULL,                           -- [{path, name}] attached to the report
    status varchar(12) NOT NULL DEFAULT 'NEW',
    assignee_user_id int4 NULL REFERENCES public.app_user(id),
    reporter_user_id int4 NOT NULL REFERENCES public.app_user(id),  -- who it is about: the person serving when a shared counter login sent it
    created_by int4 NOT NULL REFERENCES public.app_user(id),        -- the login that sent it
    context jsonb NOT NULL DEFAULT '{}'::jsonb, -- route, app version, browser
    resolution text NULL,
    resolved_on timestamptz NULL,
    resolved_by int4 NULL REFERENCES public.app_user(id),
    duplicate_of int4 NULL REFERENCES public.app_feedback(id),
    awaiting_staff bool NOT NULL DEFAULT true,  -- the reporter spoke last (or it is new): the managers owe a reply
    reporter_unread bool NOT NULL DEFAULT false,-- staff spoke last and the reporter has not opened it yet
    last_activity_on timestamptz NOT NULL DEFAULT now(),
    created_on timestamptz NOT NULL DEFAULT now(),
    archive bool NOT NULL DEFAULT false,
    CONSTRAINT app_feedback_kind_chk CHECK (kind IN ('problem', 'question', 'suggestion', 'data')),
    CONSTRAINT app_feedback_status_chk CHECK (status IN ('NEW', 'IN_PROGRESS', 'WAITING', 'ANSWERED', 'PLANNED', 'DECLINED', 'DUPLICATE', 'CLOSED')),
    CONSTRAINT app_feedback_impact_chk CHECK (impact IS NULL OR impact IN ('blocks', 'workaround', 'minor'))
);
CREATE INDEX IF NOT EXISTS app_feedback_reporter_idx ON public.app_feedback (reporter_user_id, last_activity_on DESC);
CREATE INDEX IF NOT EXISTS app_feedback_created_by_idx ON public.app_feedback (created_by, created_on DESC);
CREATE INDEX IF NOT EXISTS app_feedback_inbox_idx ON public.app_feedback (business_id, status, last_activity_on DESC) WHERE NOT archive;

-- the thread: replies both ways, status changes, and internal notes the reporter never sees
CREATE TABLE IF NOT EXISTS public.app_feedback_note (
    id serial4 PRIMARY KEY,
    feedback_id int4 NOT NULL REFERENCES public.app_feedback(id) ON DELETE CASCADE,
    kind varchar(10) NOT NULL DEFAULT 'REPLY',
    body text NOT NULL,
    files jsonb NULL,
    created_by int4 NOT NULL REFERENCES public.app_user(id),
    created_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT app_feedback_note_kind_chk CHECK (kind IN ('REPLY', 'INTERNAL', 'STATUS'))
);
CREATE INDEX IF NOT EXISTS app_feedback_note_idx ON public.app_feedback_note (feedback_id, created_on);

-- the page: owners answer; everyone who works may report and see their own (the roles that have the to-do list)
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"feedback","path":"/secure/feedback","policies":[{"action":"add"},{"action":"manage"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "feedback")');
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"feedback","path":"/secure/feedback","policies":[{"action":"add"}]}]'::jsonb)::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "todos")')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "feedback")');
