-- 062_shift_handover_digital.sql
-- A shift can end two ways. END_OF_DAY: the store closes (the full closing checklist: lock up, lights, cash secured).
-- HANDOVER: the store stays open and the shift passes to another staff member, so only the drawer count applies; the
-- counted cash becomes the incoming person's opening float and their shift opens straight away.
-- At closing the person also enters what each digital provider's terminal shows; it is kept next to what the system
-- recorded, with the difference. `shiftdesk` is the page where staff open and close their shift (/secure/shift).

ALTER TABLE public.store_shifts ADD COLUMN IF NOT EXISTS close_type varchar(10);
ALTER TABLE public.store_shifts ADD COLUMN IF NOT EXISTS handover_to_user_id int4 REFERENCES public.app_user(id);
ALTER TABLE public.store_shifts ADD COLUMN IF NOT EXISTS handover_from_shift_id int4 REFERENCES public.store_shifts(id);
ALTER TABLE public.store_shifts ADD COLUMN IF NOT EXISTS closing_digital jsonb;   -- [{provider, system, counted, variance}]
ALTER TABLE public.store_shifts DROP CONSTRAINT IF EXISTS store_shifts_close_type_chk;
ALTER TABLE public.store_shifts ADD CONSTRAINT store_shifts_close_type_chk CHECK (close_type IS NULL OR close_type IN ('END_OF_DAY', 'HANDOVER'));

UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"shiftdesk","path":"/secure/shift","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Store Head', 'Sales Staff') AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "shiftdesk")');
