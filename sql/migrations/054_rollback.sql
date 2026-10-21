UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'staffcredit')::json
WHERE name = 'Business Head';
DROP TABLE IF EXISTS public.staff_credit_entry;
DROP TABLE IF EXISTS public.staff_credit_limit;
ALTER TABLE public.sale DROP COLUMN IF EXISTS staff_credit_user_id, DROP COLUMN IF EXISTS staff_credit_amount;
