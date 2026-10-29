-- 111: the compliance register (RECOGNITION_AND_COMPLIANCE sections 3 and 7, implementation plan stage 2).
--  * compliance_instance: one row per thing owed (an item for a store and, where it is personal, a person, for a period). The rows are made and
--    closed by the register's generators from facts that already exist (stock counts, licences, shifts, parked bills...); a row is DONE when the
--    fact no longer owes it. The step on the ladder is worked out from the due day and the business's settings, and stored with the last change.
--  * compliance_event: what happened to an instance (opened, step changed, closed, "not mine", waiver asked, granted or declined).
--  * compliance_waiver: a request by a store head and the Business Head's decision, for a number of days.
--  * the compliance permission group (Oversight > Compliance) for the people who run the business and the store head.

CREATE TABLE IF NOT EXISTS public.compliance_instance (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL,
    store_id int4 NULL,
    person_id int4 NULL,
    item_key varchar(30) NOT NULL,
    period_key varchar(60) NOT NULL DEFAULT '',
    due_on date NOT NULL,
    state varchar(8) NOT NULL DEFAULT 'OPEN',
    step varchar(10) NULL,
    detail jsonb NULL,
    not_mine boolean NOT NULL DEFAULT false,
    opened_on timestamptz NOT NULL DEFAULT now(),
    step_on timestamptz NOT NULL DEFAULT now(),
    closed_on timestamptz NULL,
    CONSTRAINT compliance_instance_state_chk CHECK (state IN ('OPEN', 'DONE'))
);
CREATE UNIQUE INDEX IF NOT EXISTS compliance_instance_uq
    ON public.compliance_instance (business_id, item_key, coalesce(store_id, 0), coalesce(person_id, 0), period_key);
CREATE INDEX IF NOT EXISTS compliance_instance_open_idx ON public.compliance_instance (business_id, state);
CREATE INDEX IF NOT EXISTS compliance_instance_person_idx ON public.compliance_instance (person_id) WHERE state = 'OPEN';

CREATE TABLE IF NOT EXISTS public.compliance_event (
    id serial4 PRIMARY KEY,
    instance_id int4 NOT NULL REFERENCES public.compliance_instance (id) ON DELETE CASCADE,
    kind varchar(20) NOT NULL,
    actor_id int4 NULL,
    note varchar(300) NULL,
    created_on timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS compliance_event_instance_idx ON public.compliance_event (instance_id);

CREATE TABLE IF NOT EXISTS public.compliance_waiver (
    id serial4 PRIMARY KEY,
    instance_id int4 NOT NULL REFERENCES public.compliance_instance (id) ON DELETE CASCADE,
    status varchar(10) NOT NULL DEFAULT 'REQUESTED',
    requested_by int4 NULL,
    requested_on timestamptz NOT NULL DEFAULT now(),
    reason varchar(300) NOT NULL,
    decided_by int4 NULL,
    decided_on timestamptz NULL,
    days int4 NULL,
    until date NULL,
    decision_note varchar(300) NULL,
    CONSTRAINT compliance_waiver_status_chk CHECK (status IN ('REQUESTED', 'GRANTED', 'DECLINED'))
);
CREATE INDEX IF NOT EXISTS compliance_waiver_instance_idx ON public.compliance_waiver (instance_id);

-- the people who run the business and the store head may open the register
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"compliance","path":"/secure/compliance","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator', 'Store Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "compliance")');
