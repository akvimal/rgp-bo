-- 080: how many documents a hosted trial or demo has uploaded and how many scans it has read (counted so the control plane's limits can be held).
CREATE TABLE IF NOT EXISTS public.platform_counter (
  kind   text NOT NULL,
  period text NOT NULL,
  n      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, period)
);
