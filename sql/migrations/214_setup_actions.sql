-- 214: Setup actions that were the owner roles by name only get actions (MENU_AND_PERMISSIONS step E, Setup).
--   businessprofile : modules.manage, transfer.export, transfer.import   (switch modules and apply a preset; export and import the business setup)
--   users           : mfareset                                          (unlink someone's authenticator)
-- The owner roles (Business Head, Owner-operator) get the three businessprofile actions where they already hold that page: those were owner-only
-- by name, so nobody else loses anything. mfareset goes to every role holding users edit (a Store Head could reset the authenticator of their
-- own staff before, as a manager of that person). There is no admin password reset in the app, so there is no users.resetpassword.
-- Rollback: 214_rollback.sql.
UPDATE public.app_role r
SET permissions = (
  SELECT coalesce(jsonb_agg(
    CASE
      WHEN e->>'resource' = 'businessprofile' AND r.name IN ('Business Head', 'Owner-operator') THEN
        jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || (
          SELECT coalesce(jsonb_agg(jsonb_build_object('action', a)), '[]'::jsonb)
          FROM unnest(ARRAY['modules.manage', 'transfer.export', 'transfer.import']) AS a
          WHERE NOT coalesce(e->'policies', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('action', a))
        ))
      WHEN e->>'resource' = 'users'
           AND (r.name IN ('Business Head', 'Owner-operator') OR coalesce(e->'policies', '[]'::jsonb) @> '[{"action":"edit"}]'::jsonb)
           AND NOT coalesce(e->'policies', '[]'::jsonb) @> '[{"action":"mfareset"}]'::jsonb THEN
        jsonb_set(e, '{policies}', coalesce(e->'policies', '[]'::jsonb) || '[{"action":"mfareset"}]'::jsonb)
      ELSE e END), '[]'::jsonb)
  FROM jsonb_array_elements(r.permissions::jsonb) e
)::json
WHERE jsonb_path_exists(r.permissions::jsonb, '$[*] ? (@.resource == "businessprofile" || @.resource == "users")');
