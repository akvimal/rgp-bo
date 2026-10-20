-- users.sql (one-off, prod upgrade). User housekeeping done at cutover.
--   psql -v ON_ERROR_STOP=1 -v siteadmin_hash='<bcrypt hash>' -f users.sql
-- Generate the hash without typing the password into shell history:
--   docker compose exec api node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" '<password>'

-- 1. Retire purushoth the way the app does (soft delete): his sales/purchases keep pointing at the row.
update public.app_user
   set active = false, archive = true, updated_on = now()
 where email = 'purushoth@rgp.com';
delete from public.user_stores
 where user_id in (select id from public.app_user where email = 'purushoth@rgp.com');

-- 2. Separate Site Admin login (platform role: manages Business Heads only, no business, no store).
insert into public.app_user (email, full_name, password, role_id, business_id, active, archive)
select 'siteadmin@rgp.com', 'Site Admin', :'siteadmin_hash', r.id, null, true, false
from public.app_role r
where r.name = 'Site Admin'
  and not exists (select 1 from public.app_user where email = 'siteadmin@rgp.com');

select u.email, r.name as role, u.active, u.archive from public.app_user u join public.app_role r on r.id = u.role_id order by u.id;
