-- 203: KPI gates and the customer-capture measure.
-- A gate is a measure that carries no points: if it is not met the month's incentive is nil, whatever the points. It is for legal and safety duties
-- (expired medicine sold, a scheduled drug sold without prescription details), where good sales must not hide a breach. A gate is either measured by
-- the system (a figure against a limit) or confirmed pass or fail by the manager. Points stay as they were.
ALTER TABLE public.hr_kpi_metric ADD COLUMN IF NOT EXISTS is_gate boolean NOT NULL DEFAULT false;

-- a gate has no points, so the maximum may be zero (it was "above zero")
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.hr_kpi_metric'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%max_points%' LOOP
    EXECUTE format('ALTER TABLE public.hr_kpi_metric DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.hr_kpi_metric ADD CONSTRAINT hr_kpi_metric_max_points_chk CHECK (max_points >= 0 AND (is_gate OR max_points > 0));
