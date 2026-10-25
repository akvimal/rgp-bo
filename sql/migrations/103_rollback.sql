-- rollback of 103_finance_bank.sql
DROP TABLE IF EXISTS public.records_attestation;
DROP TABLE IF EXISTS public.bank_signoff;
DROP TABLE IF EXISTS public.bank_rule;
DROP TABLE IF EXISTS public.bank_txn;
DROP TABLE IF EXISTS public.bank_import;
DROP TABLE IF EXISTS public.bank_account;
UPDATE public.app_role SET permissions = (SELECT coalesce(json_agg(e), '[]'::json) FROM json_array_elements(permissions) e WHERE e->>'resource' <> 'finance')
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "finance")');
DELETE FROM public.app_setting WHERE setting_key IN ('bank_recon_tolerance', 'records_retention_years');
