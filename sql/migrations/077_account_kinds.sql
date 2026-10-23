-- 077: account kinds (OPERATING_MODES step 4).
--   Owner-operator  the only login of a one-person shop: everything a Business Head runs day to day, none of the user, role or staff-admin screens
--   Counter         the shared till login: sales and shift only; every bill asks who is serving
--   Personal        a person's own login for My HR, leave and ratings; no transactions
-- plus the link that ties extra logins (a counter or sales login the person also uses) to one HR person record.
-- Roles are built from the existing Business Head / Sales Staff rows so they follow whatever those carry today.

DO $$
DECLARE
  bh json; ss json; next_id integer;
BEGIN
  SELECT permissions INTO bh FROM public.app_role WHERE name = 'Business Head';
  SELECT permissions INTO ss FROM public.app_role WHERE name = 'Sales Staff';

  IF bh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.app_role WHERE name = 'Owner-operator') THEN
    SELECT COALESCE(MAX(id), 0) + 1 INTO next_id FROM public.app_role;
    INSERT INTO public.app_role (id, name, permissions, locked, active, archive)
    SELECT next_id, 'Owner-operator',
           (SELECT jsonb_agg(e) FROM jsonb_array_elements(bh::jsonb) e
             WHERE e->>'resource' NOT IN ('roles', 'users', 'hr', 'kpirate', 'leaveapprove', 'audit', 'staffcredit', 'staffsales', 'grievances'))::json,
           false, true, false;
  END IF;

  IF ss IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.app_role WHERE name = 'Counter') THEN
    SELECT COALESCE(MAX(id), 0) + 1 INTO next_id FROM public.app_role;
    INSERT INTO public.app_role (id, name, permissions, locked, active, archive)
    SELECT next_id, 'Counter',
           (SELECT jsonb_agg(e) FROM jsonb_array_elements(ss::jsonb) e
             WHERE e->>'resource' IN ('site', 'stock', 'customers', 'sales', 'store', 'shiftdesk', 'inquiries', 'refills'))::json,
           false, true, false;
  END IF;

  IF ss IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.app_role WHERE name = 'Personal') THEN
    SELECT COALESCE(MAX(id), 0) + 1 INTO next_id FROM public.app_role;
    INSERT INTO public.app_role (id, name, permissions, locked, active, archive)
    SELECT next_id, 'Personal',
           (jsonb_build_array(jsonb_build_object('resource', 'site', 'path', jsonb_build_array('/secure/profile')))
             || COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(ss::jsonb) e WHERE e->>'resource' IN ('myhr', 'mykpi')), '[]'::jsonb))::json,
           false, true, false;
  END IF;

  PERFORM setval(pg_get_serial_sequence('public.app_role', 'id'), (SELECT MAX(id) FROM public.app_role));
END $$;

-- another login of the same person: the HR record then follows the person whichever login they used
CREATE TABLE IF NOT EXISTS public.hr_employee_account (
  user_id     integer PRIMARY KEY REFERENCES public.app_user(id),
  employee_id integer NOT NULL REFERENCES public.hr_employee(id) ON DELETE CASCADE,
  created_by  integer,
  created_on  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_employee_account_employee ON public.hr_employee_account (employee_id);
