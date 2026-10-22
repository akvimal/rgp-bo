-- 061_customer_inquiries.sql
-- Customer inquiries: a customer asks for a product that is not on the shelf, a price, medical information, or leaves an
-- order request. Staff record it, it is assigned to someone with a due date, and it is closed with an outcome (sold,
-- ordered, not available, referred, answered, no response, dropped). Closed and late inquiries feed the KPI measures
-- INQUIRIES_CLOSED / INQUIRIES_LATE.

CREATE TABLE IF NOT EXISTS public.customer_inquiry (
  id            serial PRIMARY KEY,
  store_id      int4 NOT NULL REFERENCES public.stores(id),
  customer_id   int4 REFERENCES public.customer(id),
  customer_name varchar(80),
  mobile        varchar(20),
  kind          varchar(10) NOT NULL DEFAULT 'PRODUCT',
  product_text  varchar(120),
  details       varchar(500) NOT NULL,
  status        varchar(6) NOT NULL DEFAULT 'OPEN',
  outcome       varchar(14),
  closing_note  varchar(300),
  due_on        date NOT NULL,
  assigned_to   int4 NOT NULL REFERENCES public.app_user(id),
  raised_by     int4 NOT NULL REFERENCES public.app_user(id),
  raised_on     timestamptz NOT NULL DEFAULT now(),
  closed_by     int4 REFERENCES public.app_user(id),
  closed_on     timestamptz,
  CONSTRAINT customer_inquiry_kind_chk    CHECK (kind IN ('PRODUCT', 'PRICE', 'MEDICAL', 'ORDER', 'OTHER')),
  CONSTRAINT customer_inquiry_status_chk  CHECK (status IN ('OPEN', 'CLOSED')),
  CONSTRAINT customer_inquiry_outcome_chk CHECK (outcome IS NULL OR outcome IN ('SOLD', 'ORDERED', 'NOT_AVAILABLE', 'REFERRED', 'ANSWERED', 'NO_RESPONSE', 'DROPPED')),
  CONSTRAINT customer_inquiry_closed_chk  CHECK ((status = 'OPEN' AND outcome IS NULL AND closed_on IS NULL) OR (status = 'CLOSED' AND outcome IS NOT NULL AND closed_on IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS customer_inquiry_assignee_idx ON public.customer_inquiry (assigned_to, status);
CREATE INDEX IF NOT EXISTS customer_inquiry_store_idx    ON public.customer_inquiry (store_id, status, due_on);

-- Business Head and Store Head: everything (Store Head within their stores); Sales Staff: raise and close their own
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"inquiries","path":"/secure/inquiries","policies":[{"action":"view"},{"action":"add"},{"action":"close"},{"action":"manage"}]}]'::jsonb)::json
WHERE name IN ('Business Head', 'Store Head') AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "inquiries")');
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"inquiries","path":"/secure/inquiries","policies":[{"action":"view"},{"action":"add"},{"action":"close"}]}]'::jsonb)::json
WHERE name = 'Sales Staff' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "inquiries")');
