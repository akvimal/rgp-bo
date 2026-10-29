-- 105: returns can be switched off for a business (module "returns", stored with the business's modules) or for one store.
--  * stores.returns_allowed: false means this store takes no returns, even when the business does. True (the default) follows the business.
--    A store can only narrow what the business allows; it cannot switch returns on for a business that has them off.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS returns_allowed boolean NOT NULL DEFAULT true;

-- the returns permission group (the Returns tab) is hidden with the module; nothing to change in app_role
