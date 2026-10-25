-- 104_pharmacy_drug_register.sql
-- The online register of Schedule H, H1 and X drugs, as the first piece of the PHARMACY PACK: the business type says which packs a business has, a
-- pack's modules are switched on for its business type and can be switched off, and the register is a module (drug_register) of that pack.
-- Existing businesses are pharmacies and keep everything.

ALTER TABLE public.business ADD COLUMN IF NOT EXISTS business_type varchar(20) NOT NULL DEFAULT 'pharmacy';

-- the people who prescribe: kept from the bills, so the next bill can pick them
CREATE TABLE IF NOT EXISTS public.prescriber (
  id          serial PRIMARY KEY,
  business_id int4 NOT NULL REFERENCES public.business(id),
  name        varchar(100) NOT NULL,
  reg_no      varchar(40),
  address     varchar(200),
  phone       varchar(20),
  active      boolean NOT NULL DEFAULT true,
  created_by  int4 REFERENCES public.app_user(id),
  created_on  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS prescriber_uq ON public.prescriber (business_id, upper(name), coalesce(upper(reg_no), ''));

-- one line per scheduled drug supplied. A bill that is changed later supersedes its lines; nothing is deleted.
CREATE TABLE IF NOT EXISTS public.schedule_register (
  id               serial PRIMARY KEY,
  business_id      int4 NOT NULL REFERENCES public.business(id),
  store_id         int4 REFERENCES public.stores(id),
  schedule         varchar(3) NOT NULL,
  serial_no        int4 NOT NULL,                        -- the number in the register, per business and schedule
  sale_id          int4 NOT NULL REFERENCES public.sale(id),
  sale_item_id     int4,
  entry_on         timestamptz NOT NULL,
  bill_no          int4,
  product_id       int4,
  drug_name        varchar(200) NOT NULL,
  batch            varchar(60),
  exp_date         date,
  qty              int4 NOT NULL,
  pack             int4,
  patient_name     varchar(100) NOT NULL,
  patient_address  varchar(250),
  patient_age      varchar(10),
  prescriber_id    int4 REFERENCES public.prescriber(id),
  prescriber_name  varchar(100) NOT NULL,
  prescriber_reg_no varchar(40),
  prescriber_address varchar(200),
  rx_date          date,
  supplied_by      int4 REFERENCES public.app_user(id),
  superseded_on    timestamptz,
  superseded_by    int4 REFERENCES public.app_user(id),
  created_on       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_register_schedule_chk CHECK (schedule IN ('H', 'H1', 'X')),
  CONSTRAINT schedule_register_serial_uq UNIQUE (business_id, schedule, serial_no)
);
CREATE INDEX IF NOT EXISTS schedule_register_sale_idx ON public.schedule_register (sale_id);
CREATE INDEX IF NOT EXISTS schedule_register_date_idx ON public.schedule_register (business_id, schedule, entry_on);

-- the people who run the shop may read and print it (the counter writes it, through the bill)
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"scheduleregister","path":"/secure/schedule-register","policies":[{"action":"view"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Owner-operator', 'Store Head')
  AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "scheduleregister")');

-- which schedules need the patient and the prescriber on the bill, and when the online register began (before it, the paper register)
INSERT INTO public.app_setting (category, setting_key, setting_value, description)
SELECT 'pharmacy', 'schedule_register_required', 'H1,H,X', 'A bill with a drug of these schedules needs the patient and the prescriber before it is completed.'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'schedule_register_required');
INSERT INTO public.app_setting (category, setting_key, setting_value, description)
SELECT 'pharmacy', 'schedule_register_from', to_char(current_date, 'YYYY-MM-DD'), 'The date the online drug register began; earlier sales are in the paper register.'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'schedule_register_from');
