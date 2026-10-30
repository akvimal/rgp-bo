-- 118: How the business is registered, and the statutory decisions a limited company records.
--  * business.legal_form: decides how strict HR and payroll set-up is. Limited companies follow the compliance set, every other form the lite set.
--    Existing businesses stay PROPRIETORSHIP (lite) until the owner says otherwise, so nothing changes under anyone.
--  * hr_statutory: one row per statutory item (PF, ESI, PT, TDS, gratuity, bonus): does it apply, why not, and the registration number.
ALTER TABLE public.business ADD COLUMN IF NOT EXISTS legal_form varchar(20) NOT NULL DEFAULT 'PROPRIETORSHIP';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_legal_form_chk') THEN
    ALTER TABLE public.business ADD CONSTRAINT business_legal_form_chk
      CHECK (legal_form IN ('PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'OTHER'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.hr_statutory (
  code        varchar(20) PRIMARY KEY,
  applies     boolean NOT NULL,
  reason      varchar(200),
  reg_no      varchar(40),
  updated_by  int4,
  updated_on  timestamptz NOT NULL DEFAULT now()
);
