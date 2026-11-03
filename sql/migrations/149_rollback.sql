-- rollback of 149
DELETE FROM public.app_setting WHERE setting_key = 'sale_gst_guard';
