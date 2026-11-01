-- 141: what a business prints on its bill, chosen in Settings > Business details.
--   bill_show_mrp    : print the MRP column in the bill's grid (off by default)
--   bill_show_saving : print the "You saved ... on MRP" box under the total (on, as it has been)
ALTER TABLE public.business
  ADD COLUMN IF NOT EXISTS bill_show_mrp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bill_show_saving boolean NOT NULL DEFAULT true;
