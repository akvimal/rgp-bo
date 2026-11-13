-- 189: how the customer paid the delivery charge. The charge is outside the bill total, so a charge paid by UPI/card never reached the shift's digital
-- takings and the close showed a variance against the terminal. The delivery now says how its charge was paid; a digital charge counts in the digital
-- total of the shift of the sale (per provider), a cash one is simply recorded. Additive and re-runnable.
ALTER TABLE public.sale_deliveries
  ADD COLUMN IF NOT EXISTS charge_via    varchar(8)  NULL,    -- CASH, DIGITAL or NONE (not collected); null = not said yet
  ADD COLUMN IF NOT EXISTS charge_method varchar(8)  NULL,    -- for DIGITAL: UPI, Card, Wallet or Other
  ADD COLUMN IF NOT EXISTS charge_ref    varchar(40) NULL;    -- last digits of the transaction id, when there is one

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_deliveries_charge_via_chk') THEN
    ALTER TABLE public.sale_deliveries ADD CONSTRAINT sale_deliveries_charge_via_chk CHECK (charge_via IS NULL OR charge_via IN ('CASH', 'DIGITAL', 'NONE'));
  END IF;
END $$;
