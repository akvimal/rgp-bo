-- 180 rollback: WhatsApp to customers. Removes the queue and the store settings (messages already sent stay sent at WhatsApp, but the log here is lost).
UPDATE public.app_role SET permissions = (SELECT coalesce(jsonb_agg(e), '[]'::jsonb) FROM jsonb_array_elements(permissions::jsonb) e WHERE e->>'resource' <> 'whatsapp')::json
WHERE jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "whatsapp")');
ALTER TABLE public.customer DROP CONSTRAINT IF EXISTS customer_message_language_chk;
ALTER TABLE public.customer DROP COLUMN IF EXISTS message_language;
DROP TABLE IF EXISTS public.customer_message;
DROP TABLE IF EXISTS public.store_whatsapp;
