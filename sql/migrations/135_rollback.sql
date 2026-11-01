-- rollback of 135
DROP TABLE IF EXISTS public.schedule_rx_followup;
ALTER TABLE public.schedule_register DROP COLUMN IF EXISTS rx_basis, DROP COLUMN IF EXISTS rx_note, DROP COLUMN IF EXISTS rx_document_id;
