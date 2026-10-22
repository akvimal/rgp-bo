UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'expenses')::json
WHERE name IN ('Business Head', 'Store Head', 'Sales Staff');
DELETE FROM public.app_setting WHERE category = 'expense' AND setting_key = 'store_head_limit';
DROP TABLE IF EXISTS public.expense, public.expense_recurring, public.expense_category;
