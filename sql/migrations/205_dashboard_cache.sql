-- 205: dashboard figures kept between opens (hourly / daily / weekly by how fast the data changes), so a restart does not lose them and an open of the
-- dashboard is one quick read. A row is one figure for one business, role, store scope and period (the key says which). Additive and re-runnable.
CREATE TABLE IF NOT EXISTS public.dashboard_cache (
  key      text PRIMARY KEY,
  tier     text NOT NULL,
  payload  jsonb NOT NULL,
  built_at timestamptz NOT NULL DEFAULT now(),
  stale    boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS dashboard_cache_tier_idx ON public.dashboard_cache (tier);
