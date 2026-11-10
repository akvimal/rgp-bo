-- 180: WhatsApp messages to customers (bill copy first), one WhatsApp number per store, through the Meta Cloud API.
--   store_whatsapp   : the store's own WhatsApp number (phone number id) and its access token (sealed, like the AI key). mode MOCK sends nothing
--                      anywhere (the message is marked sent with a made-up id) so the screens can be tried before Meta credentials exist.
--   customer_message : every message to a customer: what, to whom, and whether it went. Written first, sent by a worker, so a failure is retried
--                      and a bill is never sent twice.
--   customer.message_language : en / ta, the language of the templates this customer is sent.
CREATE TABLE IF NOT EXISTS public.store_whatsapp (
    store_id int4 PRIMARY KEY REFERENCES public.stores(id),
    mode varchar(5) NOT NULL DEFAULT 'MOCK',
    phone_number_id varchar(40) NULL,
    waba_id varchar(40) NULL,
    display_number varchar(20) NULL,
    token_sealed text NULL,
    token_hint varchar(12) NULL,
    enabled boolean NOT NULL DEFAULT false,
    auto_send_bill boolean NOT NULL DEFAULT false,
    monthly_cap int4 NOT NULL DEFAULT 1000,
    updated_on timestamptz NOT NULL DEFAULT now(),
    updated_by int4 NULL REFERENCES public.app_user(id),
    CONSTRAINT store_whatsapp_mode_chk CHECK (mode IN ('MOCK', 'LIVE')),
    CONSTRAINT store_whatsapp_cap_chk CHECK (monthly_cap BETWEEN 0 AND 100000)
);

CREATE TABLE IF NOT EXISTS public.customer_message (
    id bigserial PRIMARY KEY,
    business_id int4 NULL,
    store_id int4 NOT NULL REFERENCES public.stores(id),
    customer_id int4 NOT NULL REFERENCES public.customer(id),
    sale_id int4 NULL REFERENCES public.sale(id),
    channel varchar(10) NOT NULL DEFAULT 'WHATSAPP',
    kind varchar(20) NOT NULL,
    template varchar(60) NOT NULL,
    language varchar(5) NOT NULL DEFAULT 'en',
    params jsonb NOT NULL DEFAULT '[]'::jsonb,
    to_mobile varchar(20) NOT NULL,
    status varchar(10) NOT NULL DEFAULT 'PENDING',
    attempts int4 NOT NULL DEFAULT 0,
    send_after timestamptz NOT NULL DEFAULT now(),
    last_error varchar(300) NULL,
    provider_id varchar(80) NULL,
    created_by int4 NULL REFERENCES public.app_user(id),
    created_on timestamptz NOT NULL DEFAULT now(),
    sent_on timestamptz NULL,
    delivered_on timestamptz NULL,
    read_on timestamptz NULL,
    CONSTRAINT customer_message_status_chk CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED')),
    CONSTRAINT customer_message_kind_chk CHECK (kind IN ('BILL', 'REFILL', 'DUES', 'DELIVERY', 'REVIEW'))
);
-- a bill goes to a customer once
CREATE UNIQUE INDEX IF NOT EXISTS customer_message_bill_uq ON public.customer_message (kind, sale_id) WHERE sale_id IS NOT NULL AND kind = 'BILL' AND status <> 'FAILED';
CREATE INDEX IF NOT EXISTS customer_message_due_idx ON public.customer_message (send_after) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS customer_message_store_idx ON public.customer_message (store_id, created_on DESC);
CREATE INDEX IF NOT EXISTS customer_message_customer_idx ON public.customer_message (customer_id, created_on DESC);

ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS message_language varchar(2) NULL;
DO $$ BEGIN
  ALTER TABLE public.customer ADD CONSTRAINT customer_message_language_chk CHECK (message_language IS NULL OR message_language IN ('en', 'ta'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Business Head: everything. Store Head: send and see (not the number and token).
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"whatsapp","path":"/secure/whatsapp","policies":[{"action":"view"},{"action":"send"},{"action":"settings"}]}]'::jsonb)::json
WHERE name = 'Business Head' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "whatsapp")');
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"whatsapp","path":"/secure/whatsapp","policies":[{"action":"view"},{"action":"send"}]}]'::jsonb)::json
WHERE name = 'Store Head' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "whatsapp")');
