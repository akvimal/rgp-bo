-- 038_audit_event.sql
-- Append-only audit trail: who did what, when, to which record. Written by the API (login events,
-- every mutating request, and explicit events such as sale edits). Rows can be inserted, never updated
-- or deleted, so a staff member with database access through the app cannot rewrite history.
-- Also grants the `audit` screen resource to Business Head.

CREATE TABLE IF NOT EXISTS public.audit_event (
  id            bigserial PRIMARY KEY,
  occurred_on   timestamptz NOT NULL DEFAULT now(),
  user_id       int4 NULL,            -- signed-in user (NULL for a failed login with unknown email)
  acting_user_id int4 NULL,           -- person the action was recorded for, when different from user_id
  action        text NOT NULL,        -- auth.login, auth.login_failed, sale.edit, http.post, ...
  entity_type   text NULL,
  entity_id     text NULL,
  summary       text NULL,
  details       jsonb NULL,
  status        int4 NULL,            -- HTTP status for request events
  ip            text NULL
);

CREATE INDEX IF NOT EXISTS audit_event_occurred_idx ON public.audit_event (occurred_on DESC);
CREATE INDEX IF NOT EXISTS audit_event_user_idx     ON public.audit_event (user_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS audit_event_action_idx   ON public.audit_event (action, occurred_on DESC);
CREATE INDEX IF NOT EXISTS audit_event_entity_idx   ON public.audit_event (entity_type, entity_id);

CREATE OR REPLACE FUNCTION public.audit_event_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_event_no_change ON public.audit_event;
CREATE TRIGGER audit_event_no_change
  BEFORE UPDATE OR DELETE ON public.audit_event
  FOR EACH ROW EXECUTE FUNCTION public.audit_event_immutable();

DROP TRIGGER IF EXISTS audit_event_no_truncate ON public.audit_event;
CREATE TRIGGER audit_event_no_truncate
  BEFORE TRUNCATE ON public.audit_event
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_event_immutable();

UPDATE public.app_role
SET permissions = (
  permissions::jsonb ||
  '[{"resource":"audit","path":"/secure/quality/audit","policies":[{"action":"view"}]}]'::jsonb
)::json
WHERE name = 'Business Head'
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "audit")');
