-- 179: what a delivery cost, and how it was paid. A delivery's cost can be paid in cash from the counter (an entry on the open shift's cash ledger, so the
-- expected cash falls), digitally (an expense in the Expenses ledger, with its payment mode and approval), left unpaid for now, or be no cost at all. The
-- delivery keeps a link to the entry it made (or to an entry that was already there: expenses entered separately before, linked afterwards), so saving twice
-- does not pay twice and a later change updates the same entry. Also keeps who confirmed the
-- delivery as a user (not only as typed text). Additive and re-runnable.
ALTER TABLE public.sale_deliveries
  ADD COLUMN IF NOT EXISTS cost_paid_via   varchar(8)  NULL,       -- CASH, DIGITAL, UNPAID or NONE; null = not said yet
  ADD COLUMN IF NOT EXISTS cost_paid_mode  varchar(8)  NULL,       -- for DIGITAL: UPI, BANK, CARD or CHEQUE
  ADD COLUMN IF NOT EXISTS cost_paid_ref   varchar(60) NULL,       -- the transaction reference, when there is one
  ADD COLUMN IF NOT EXISTS cost_paid_on    timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cost_paid_by    int4        NULL,
  ADD COLUMN IF NOT EXISTS cash_entry_id   int4        NULL,       -- store_cash_accounts.id made for the cost
  ADD COLUMN IF NOT EXISTS expense_id      int4        NULL,       -- expense.id made for the cost
  ADD COLUMN IF NOT EXISTS cost_linked     boolean     NOT NULL DEFAULT false,   -- the entry was already there and was linked to this delivery: it is never changed or deleted from here
  ADD COLUMN IF NOT EXISTS confirmed_by_user int4      NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_deliveries_cost_via_chk') THEN
    ALTER TABLE public.sale_deliveries ADD CONSTRAINT sale_deliveries_cost_via_chk CHECK (cost_paid_via IS NULL OR cost_paid_via IN ('CASH', 'DIGITAL', 'UNPAID', 'NONE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_deliveries_cost_mode_chk') THEN
    ALTER TABLE public.sale_deliveries ADD CONSTRAINT sale_deliveries_cost_mode_chk CHECK (cost_paid_mode IS NULL OR cost_paid_mode IN ('UPI', 'BANK', 'CARD', 'CHEQUE'));
  END IF;
END $$;

-- one cash entry or expense is the cost of one delivery
CREATE UNIQUE INDEX IF NOT EXISTS sale_deliveries_cash_entry_uq ON public.sale_deliveries (cash_entry_id) WHERE cash_entry_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sale_deliveries_expense_uq ON public.sale_deliveries (expense_id) WHERE expense_id IS NOT NULL;
