-- 209 rollback: the Reports permission goes back to a bare presence (the page opens, nothing more).
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(CASE WHEN e->>'resource' = 'reports' THEN e - 'policies' ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "reports")');
