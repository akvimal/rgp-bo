-- Rolls back 038_audit_event.sql (drops the audit trail - export it first if it matters).
UPDATE public.app_role
SET permissions = (
  SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(permissions::jsonb) elem
  WHERE elem->>'resource' <> 'audit'
)::json;
DROP TRIGGER IF EXISTS audit_event_no_truncate ON public.audit_event;
DROP TRIGGER IF EXISTS audit_event_no_change ON public.audit_event;
DROP TABLE IF EXISTS public.audit_event;
DROP FUNCTION IF EXISTS public.audit_event_immutable();
