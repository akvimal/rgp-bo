UPDATE public.app_role
SET permissions = (
  SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(permissions::jsonb) elem
  WHERE elem->>'resource' <> 'grievances'
)::json;
DROP TABLE IF EXISTS public.grievance_note;
DROP TABLE IF EXISTS public.grievance;
