-- Rollback 153: remove registered store PCs and their setting.
DROP TABLE IF EXISTS public.store_device;
DELETE FROM public.app_setting WHERE setting_key = 'trusted_device_mfa';
