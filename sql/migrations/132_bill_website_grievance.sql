-- 132: the business's website and a separate phone number for grievances, both printed at the end of the bill.
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS website character varying(120);
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS grievance_phone character varying(60);
