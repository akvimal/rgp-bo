-- the calendar page: a read-only view of what is dated across the app. Every role that has the to-do list (everyone who works) may open it;
-- what it shows is still limited by what each role may see on the owning screen. No table is added.
UPDATE public.app_role
SET permissions = (permissions::jsonb || '[{"resource":"calendar","path":"/secure/calendar","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "todos")')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "calendar")');
