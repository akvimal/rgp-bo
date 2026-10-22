-- 067_my_hr.sql
-- Staff self-service: "My HR" (profile, pay slips once payroll is approved, leave balance and applying for leave, attendance,
-- staff credit) for anyone whose login is linked to a staff record, and the leave approvals inbox for the Business Head and
-- Store Heads (a Store Head decides leave for staff of their own stores, never their own).

UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"myhr","path":"/secure/my-hr","policies":[{"action":"view"},{"action":"apply"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Store Head', 'Sales Staff') AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "myhr")');

UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"leaveapprove","path":"/secure/leave-approvals","policies":[{"action":"decide"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Store Head') AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "leaveapprove")');
