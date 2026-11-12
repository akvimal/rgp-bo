-- 187 rollback: out-passes no longer name an audit, and the audit expiry explanations go.
DROP TABLE IF EXISTS public.stock_audit_expiry_note;
DROP INDEX IF EXISTS public.disposal_pass_audit_idx;
ALTER TABLE public.disposal_pass DROP COLUMN IF EXISTS audit_id;
