-- 187: expiry inside the stock audit. An out-pass can say which audit it came from, and an audit can carry a short explanation for each expired or near-expiry
-- batch it covered that has no out-pass (for example "thrown away by the night staff on 3 Nov"). Safe to run twice.
ALTER TABLE public.disposal_pass ADD COLUMN IF NOT EXISTS audit_id int4 REFERENCES public.stock_audit(id);
CREATE INDEX IF NOT EXISTS disposal_pass_audit_idx ON public.disposal_pass (audit_id) WHERE audit_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stock_audit_expiry_note (
  id          serial PRIMARY KEY,
  audit_id    int4 NOT NULL REFERENCES public.stock_audit(id) ON DELETE CASCADE,
  item_id     int4 NOT NULL REFERENCES public.purchase_invoice_item(id),
  note        varchar(300) NOT NULL,
  created_by  int4 REFERENCES public.app_user(id),
  created_on  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_audit_expiry_note_uq UNIQUE (audit_id, item_id)
);
