-- 103_finance_bank.sql
-- Finance for the Business Head: the business's bank accounts (business or store level), the statements imported for them (any bank: the columns are
-- mapped, not fixed), each bank line tagged and matched to the books where it can be, a monthly reconciliation signed off with the reasons for any
-- difference, and the attestation that the paper Schedule H1 register was checked.

CREATE TABLE IF NOT EXISTS public.bank_account (
  id              serial PRIMARY KEY,
  business_id     int4 NOT NULL REFERENCES public.business(id),
  store_id        int4 REFERENCES public.stores(id),          -- null = the business's own account
  name            varchar(80) NOT NULL,
  bank_name       varchar(60),
  last4           varchar(4),
  opening_balance numeric(14,2),
  opening_date    date,
  mapping         jsonb,                                       -- the columns of this bank's file, once mapped
  active          boolean NOT NULL DEFAULT true,
  created_by      int4 REFERENCES public.app_user(id),
  created_on      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_import (
  id                 serial PRIMARY KEY,
  account_id         int4 NOT NULL REFERENCES public.bank_account(id),
  file_name          varchar(150),
  rows_total         int4 NOT NULL DEFAULT 0,
  rows_new           int4 NOT NULL DEFAULT 0,
  rows_duplicate     int4 NOT NULL DEFAULT 0,
  period_from        date,
  period_to          date,
  opening            numeric(14,2),
  closing            numeric(14,2),
  continuity_breaks  int4 NOT NULL DEFAULT 0,
  gap_note           varchar(200),
  uploaded_by        int4 REFERENCES public.app_user(id),
  uploaded_on        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_txn (
  id            serial PRIMARY KEY,
  account_id    int4 NOT NULL REFERENCES public.bank_account(id),
  import_id     int4 REFERENCES public.bank_import(id),
  txn_date      date NOT NULL,
  value_date    date,
  narration     text,
  ref           varchar(40),
  debit         numeric(14,2) NOT NULL DEFAULT 0,
  credit        numeric(14,2) NOT NULL DEFAULT 0,
  balance       numeric(14,2),
  kind          varchar(12),                                   -- NEFT, UPI, CASH, TRANSFER, CHEQUE, CHARGE, OTHER
  counterparty  varchar(80),
  dedupe_key    char(40) NOT NULL,
  tag           varchar(24),
  vendor_id     int4 REFERENCES public.vendor(id),
  expense_category varchar(40),
  status        varchar(12) NOT NULL DEFAULT 'UNEXPLAINED',    -- UNEXPLAINED, TAGGED, MATCHED
  match_kind    varchar(12),
  match_id      int4,
  reason        varchar(120),
  note          varchar(200),
  tagged_by     int4 REFERENCES public.app_user(id),
  tagged_on     timestamptz,
  CONSTRAINT bank_txn_status_chk CHECK (status IN ('UNEXPLAINED', 'TAGGED', 'MATCHED')),
  CONSTRAINT bank_txn_one_side_chk CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT bank_txn_dedupe_uq UNIQUE (account_id, dedupe_key)
);
ALTER TABLE public.bank_txn ALTER COLUMN status TYPE varchar(12);
CREATE INDEX IF NOT EXISTS bank_txn_account_date_idx ON public.bank_txn (account_id, txn_date, id);
CREATE INDEX IF NOT EXISTS bank_txn_status_idx ON public.bank_txn (account_id, status);

-- a line that looks like this is tagged like this (kept when a person tags a line and asks for the same next time)
CREATE TABLE IF NOT EXISTS public.bank_rule (
  id               serial PRIMARY KEY,
  business_id      int4 NOT NULL REFERENCES public.business(id),
  pattern          varchar(80) NOT NULL,
  direction        varchar(6) NOT NULL DEFAULT 'ANY',
  tag              varchar(24) NOT NULL,
  vendor_id        int4 REFERENCES public.vendor(id),
  expense_category varchar(40),
  active           boolean NOT NULL DEFAULT true,
  created_by       int4 REFERENCES public.app_user(id),
  created_on       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_rule_direction_chk CHECK (direction IN ('ANY', 'DEBIT', 'CREDIT'))
);

-- a month of one account, reconciled and signed
CREATE TABLE IF NOT EXISTS public.bank_signoff (
  id         serial PRIMARY KEY,
  account_id int4 NOT NULL REFERENCES public.bank_account(id),
  month      date NOT NULL,
  signed_by  int4 NOT NULL REFERENCES public.app_user(id),
  signed_on  timestamptz NOT NULL DEFAULT now(),
  note       varchar(300),
  snapshot   jsonb,
  CONSTRAINT bank_signoff_month_chk CHECK (extract(day from month) = 1),
  CONSTRAINT bank_signoff_uq UNIQUE (account_id, month)
);

-- "the paper H1 register was checked for this month"
CREATE TABLE IF NOT EXISTS public.records_attestation (
  id          serial PRIMARY KEY,
  business_id int4 NOT NULL REFERENCES public.business(id),
  store_id    int4 REFERENCES public.stores(id),
  kind        varchar(20) NOT NULL,
  period      date NOT NULL,
  checked_by  int4 NOT NULL REFERENCES public.app_user(id),
  checked_on  timestamptz NOT NULL DEFAULT now(),
  note        varchar(200),
  CONSTRAINT records_attestation_period_chk CHECK (extract(day from period) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS records_attestation_uq ON public.records_attestation (business_id, coalesce(store_id, 0), kind, period);

-- the Business Head and the Owner-operator only
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"finance","path":"/secure/finance","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "finance")');

-- a difference up to this many rupees is accepted; records are kept this many years
INSERT INTO public.app_setting (category, setting_key, setting_value, description)
SELECT 'finance', 'bank_recon_tolerance', '100', 'A difference up to this many rupees between the books and the bank is accepted.'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'bank_recon_tolerance');
INSERT INTO public.app_setting (category, setting_key, setting_value, description)
SELECT 'records', 'records_retention_years', '8', 'Accounting and drug records are kept at least this many years.'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'records_retention_years');
