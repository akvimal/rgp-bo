-- rollback of 131: one phone number again (a store phone longer than 20 characters is cut), and the business phone is dropped
ALTER TABLE public.business DROP COLUMN IF EXISTS phone;
ALTER TABLE public.stores ALTER COLUMN phone TYPE character varying(20) USING left(phone, 20);
