-- 211 rollback: take the sensitive purchasing actions off every role again (payments and returns go back to add/edit/delete, the invoice actions to the owner roles by name).
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN e->>'resource' = 'purchases' AND jsonb_typeof(e->'policies') = 'array' THEN
      jsonb_set(e, '{policies}', coalesce((
        SELECT jsonb_agg(p) FROM jsonb_array_elements(e->'policies') p
        WHERE p->>'action' NOT IN ('payments.view', 'payments.record', 'payments.reverse', 'returns.manage', 'invoices.editcompleted', 'invoices.approvepay', 'invoices.recalculate')
      ), '[]'::jsonb))
    ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "purchases")');
