-- Rollback of 234: the loaded price list goes (it can be loaded again from the PDF).
DROP TABLE IF EXISTS public.price_ref_item;
DROP TABLE IF EXISTS public.price_ref_source;
