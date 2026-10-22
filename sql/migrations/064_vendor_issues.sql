-- 064_vendor_issues.sql
-- Vendor grievances: an invoice that needs correcting (wrong rate, quantity, tax, MRP, expiry), defective or damaged goods to
-- send back, short supply, a wrong item. Each is raised against a vendor (and usually an invoice), sent to the vendor, and
-- ends with a credit note, a refund, a replacement or a corrected invoice, or is rejected. Goods sent back leave the store's
-- stock (a RETURNED_TO_VENDOR adjustment) exactly once per line. Notes keep the conversation.

CREATE TABLE IF NOT EXISTS public.vendor_issue (
  id            serial PRIMARY KEY,
  issue_no      varchar(20) UNIQUE,
  vendor_id     int4 NOT NULL REFERENCES public.vendor(id),
  invoice_id    int4 REFERENCES public.purchase_invoice(id),
  store_id      int4 REFERENCES public.stores(id),
  kind          varchar(12) NOT NULL,
  status        varchar(12) NOT NULL DEFAULT 'OPEN',
  summary       varchar(200) NOT NULL,
  details       varchar(1000),
  claimed_amount numeric(12,2) NOT NULL DEFAULT 0,
  resolution    varchar(20),
  credit_amount numeric(12,2),
  credit_ref    varchar(60),
  resolution_note varchar(300),
  sent_on       timestamptz,
  sent_via      varchar(12),
  vendor_ref    varchar(60),
  due_on        date,
  raised_by     int4 NOT NULL REFERENCES public.app_user(id),
  raised_on     timestamptz NOT NULL DEFAULT now(),
  resolved_by   int4 REFERENCES public.app_user(id),
  resolved_on   timestamptz,
  CONSTRAINT vendor_issue_kind_chk   CHECK (kind IN ('INVOICE_FIX', 'DEFECTIVE', 'SHORT_SUPPLY', 'WRONG_ITEM', 'OTHER')),
  CONSTRAINT vendor_issue_status_chk CHECK (status IN ('OPEN', 'WITH_VENDOR', 'RESOLVED', 'REJECTED', 'CANCELLED')),
  CONSTRAINT vendor_issue_res_chk    CHECK (resolution IS NULL OR resolution IN ('CREDIT_NOTE', 'REFUND', 'REPLACEMENT', 'CORRECTED_INVOICE')),
  CONSTRAINT vendor_issue_via_chk    CHECK (sent_via IS NULL OR sent_via IN ('PHONE', 'EMAIL', 'WHATSAPP', 'VISIT', 'OTHER'))
);
CREATE INDEX IF NOT EXISTS vendor_issue_vendor_idx ON public.vendor_issue (vendor_id, status);
CREATE INDEX IF NOT EXISTS vendor_issue_invoice_idx ON public.vendor_issue (invoice_id);
CREATE INDEX IF NOT EXISTS vendor_issue_due_idx ON public.vendor_issue (due_on) WHERE status = 'WITH_VENDOR';

CREATE TABLE IF NOT EXISTS public.vendor_issue_line (
  id              serial PRIMARY KEY,
  issue_id        int4 NOT NULL REFERENCES public.vendor_issue(id) ON DELETE CASCADE,
  purchase_item_id int4 REFERENCES public.purchase_invoice_item(id),
  description     varchar(120),
  field           varchar(8),                              -- what is wrong on an invoice line: RATE / QTY / TAX / MRP / EXPIRY / BATCH / OTHER
  billed_value    varchar(40),
  correct_value   varchar(40),
  qty             int4,
  unit_cost       numeric(12,2),
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  returned_qty    int4 NOT NULL DEFAULT 0,
  returned_on     timestamptz,
  adjustment_id   int4,                                    -- the product_qtychange row that took the goods out of stock
  CONSTRAINT vendor_issue_line_field_chk CHECK (field IS NULL OR field IN ('RATE', 'QTY', 'TAX', 'MRP', 'EXPIRY', 'BATCH', 'OTHER'))
);
CREATE INDEX IF NOT EXISTS vendor_issue_line_issue_idx ON public.vendor_issue_line (issue_id);

CREATE TABLE IF NOT EXISTS public.vendor_issue_note (
  id         serial PRIMARY KEY,
  issue_id   int4 NOT NULL REFERENCES public.vendor_issue(id) ON DELETE CASCADE,
  note       varchar(500) NOT NULL,
  created_by int4 NOT NULL REFERENCES public.app_user(id),
  created_on timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_issue_note_idx ON public.vendor_issue_note (issue_id, created_on);

-- Business Head: everything. Store Head: raise, view and send goods back.
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"vendorissues","path":"/secure/vendor-issues","policies":[{"action":"view"},{"action":"add"},{"action":"return"},{"action":"manage"}]}]'::jsonb)::json
WHERE name = 'Business Head' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "vendorissues")');
UPDATE public.app_role SET permissions = (permissions::jsonb ||
  '[{"resource":"vendorissues","path":"/secure/vendor-issues","policies":[{"action":"view"},{"action":"add"},{"action":"return"}]}]'::jsonb)::json
WHERE name = 'Store Head' AND NOT jsonb_path_exists(permissions::jsonb, '$[*] ? (@.resource == "vendorissues")');
