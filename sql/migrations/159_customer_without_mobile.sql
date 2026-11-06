-- 159: a customer can be kept without a mobile number, told apart by name and location (locality).
-- The existing (name, mobile) index cannot do it: an empty mobile never clashes with another. This one makes two customers with no mobile,
-- the same name and the same location impossible (the service checks first and says so in words; this stops a race).
-- It is created only when the data has no such pair already, so the migration never fails on old data: otherwise it says so and the
-- pairs can be merged (Customers > Duplicates) or renamed, and the migration run again.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.customer WHERE mobile IS NULL AND NOT archive AND locality IS NOT NULL
              GROUP BY lower(btrim(name)), lower(btrim(locality)) HAVING count(*) > 1) THEN
    RAISE NOTICE '159: customers without a mobile share a name and location; the unique index was NOT created. Merge or rename them and run this again.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS customer_no_mobile_un ON public.customer (lower(btrim(name)), lower(btrim(locality)))
      WHERE mobile IS NULL AND NOT archive AND locality IS NOT NULL;
  END IF;
END $$;
