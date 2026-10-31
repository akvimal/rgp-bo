-- rollback of 132: the bill goes back to carrying no website or grievance number
ALTER TABLE public.business DROP COLUMN IF EXISTS grievance_phone;
ALTER TABLE public.business DROP COLUMN IF EXISTS website;
