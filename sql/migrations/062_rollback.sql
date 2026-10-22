UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'shiftdesk')::json
WHERE name IN ('Business Head', 'Store Head', 'Sales Staff');
ALTER TABLE public.store_shifts DROP CONSTRAINT IF EXISTS store_shifts_close_type_chk;
ALTER TABLE public.store_shifts DROP COLUMN IF EXISTS close_type, DROP COLUMN IF EXISTS handover_to_user_id,
  DROP COLUMN IF EXISTS handover_from_shift_id, DROP COLUMN IF EXISTS closing_digital;
