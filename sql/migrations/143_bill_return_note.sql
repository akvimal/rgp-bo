-- 143: the bill's "Please keep this bill for any return or exchange ..." line can be switched off, in Settings > Business details.
--   bill_show_return_note : print that line when returns are allowed (on, as it has been)
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS bill_show_return_note boolean NOT NULL DEFAULT true;
--   bill_return_note      : the words of that line; null prints the standard wording
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS bill_return_note varchar(300);
