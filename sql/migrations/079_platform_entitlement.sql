-- 079: the last entitlements the control plane sent this copy of the app (only used when it runs as a hosted customer; see control-plane/).
CREATE TABLE IF NOT EXISTS public.platform_entitlement (
  id         integer PRIMARY KEY CHECK (id = 1),
  token      text NOT NULL,
  fetched_on timestamptz NOT NULL DEFAULT now()
);
