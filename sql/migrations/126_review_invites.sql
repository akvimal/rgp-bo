-- 126: Inviting customers to review the store on Google, at the moment of a purchase.
--  * stores.google_review_url: the store's "write a review" link from its Google Business profile. Every bill carries a QR code for it.
--  * review_invite: each invitation sent to a customer after a larger bill (a WhatsApp message the cashier sends from the bill screen). It keeps
--    the same customer from being asked on every large bill (a guard of review_invite_guard_days) and is what a later Google integration will
--    match reviews against (a review names only the reviewer, so the match is by name and date).
--  * customer.review_optout: the customer asked not to be invited to review. Kept apart from do_not_contact, which stops every message.
--  * review_invite_min_amount: a bill at or above this gets the invitation prompt (the QR is on every bill).
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS google_review_url text NULL;
ALTER TABLE public.customer ADD COLUMN IF NOT EXISTS review_optout boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.review_invite (
  id          serial PRIMARY KEY,
  store_id    int4 NOT NULL REFERENCES public.stores(id),
  sale_id     int4 NULL REFERENCES public.sale(id),
  customer_id int4 NULL REFERENCES public.customer(id),
  channel     text NOT NULL DEFAULT 'WHATSAPP',
  created_on  timestamptz NOT NULL DEFAULT now(),
  created_by  int4 NOT NULL REFERENCES public.app_user(id),
  CONSTRAINT review_invite_channel_chk CHECK (channel IN ('WHATSAPP', 'SMS', 'IN_PERSON'))
);
CREATE INDEX IF NOT EXISTS review_invite_customer_idx ON public.review_invite (customer_id, created_on DESC);
CREATE UNIQUE INDEX IF NOT EXISTS review_invite_sale_uq ON public.review_invite (sale_id) WHERE sale_id IS NOT NULL;

INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES
  ('customers', 'review_invite_min_amount', '500', 'A bill at or above this amount offers the cashier an invitation to review the store on Google', true, false, 1, 1),
  ('customers', 'review_invite_guard_days', '90', 'Do not invite the same customer to review again within this many days', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;
