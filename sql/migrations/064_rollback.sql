UPDATE public.app_role
SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'vendorissues')::json
WHERE name IN ('Business Head', 'Store Head');
DROP TABLE IF EXISTS public.vendor_issue_note, public.vendor_issue_line, public.vendor_issue;
