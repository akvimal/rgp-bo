-- 184: an expense paid by bank transfer, cheque, card or UPI says which bank account it was paid from and carries the payment's reference (UTR or cheque number),
-- so a bank statement line can be matched to it by reference and account instead of by amount and week alone. Both are optional here: older expenses have neither,
-- and the server asks for the account only when the business has bank accounts set up. Safe to run twice.
ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS bank_account_id int4 REFERENCES public.bank_account(id);
ALTER TABLE public.expense ADD COLUMN IF NOT EXISTS reference varchar(40);
CREATE INDEX IF NOT EXISTS expense_bank_account_idx ON public.expense (bank_account_id) WHERE bank_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS expense_reference_idx ON public.expense (upper(reference)) WHERE reference IS NOT NULL;
