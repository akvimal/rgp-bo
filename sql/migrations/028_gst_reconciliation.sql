-- 028_gst_reconciliation.sql
-- WS-5 of docs/planning/PURCHASING_PAYABLES_GST_PROGRAM.md:
-- GSTR-2A/2B inward-supply reconciliation for ITC. Builds on WS-4's GST columns (migration 027).

CREATE TABLE IF NOT EXISTS public.gst_return_period (
    id serial4 NOT NULL,
    business_id int4 NOT NULL,
    period varchar(7) NOT NULL,
    status varchar NOT NULL DEFAULT 'OPEN',
    gstr2b_imported_at timestamptz NULL,
    gstr2a_imported_at timestamptz NULL,
    itc_available float8 NOT NULL DEFAULT 0,
    itc_claimed float8 NOT NULL DEFAULT 0,
    itc_on_hold float8 NOT NULL DEFAULT 0,
    itc_reversed float8 NOT NULL DEFAULT 0,
    notes varchar NULL,
    active bool DEFAULT true NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by int4 NOT NULL,
    updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by int4 NOT NULL,
    archive bool DEFAULT false NOT NULL,
    CONSTRAINT gst_return_period_pk PRIMARY KEY (id),
    CONSTRAINT gst_return_period_un UNIQUE (business_id, period),
    CONSTRAINT gst_return_period_business_fk FOREIGN KEY (business_id) REFERENCES public.business(id)
);

CREATE TABLE IF NOT EXISTS public.gst_inward_supply (
    id serial4 NOT NULL,
    business_id int4 NOT NULL,
    period varchar(7) NOT NULL,
    source varchar NOT NULL,
    supplier_gstin varchar(15) NULL,
    supplier_name varchar NULL,
    invoice_no varchar NOT NULL,
    invoice_date date NULL,
    invoice_value float8 NOT NULL DEFAULT 0,
    taxable_value float8 NOT NULL DEFAULT 0,
    cgst float8 NOT NULL DEFAULT 0,
    sgst float8 NOT NULL DEFAULT 0,
    igst float8 NOT NULL DEFAULT 0,
    cess float8 NOT NULL DEFAULT 0,
    place_of_supply varchar(2) NULL,
    reverse_charge bool NOT NULL DEFAULT false,
    itc_availability varchar NULL,
    filing_status varchar NULL,
    filing_period varchar(7) NULL,
    import_batch varchar NOT NULL,
    raw jsonb NULL,
    matched_invoice_id int4 NULL,
    active bool DEFAULT true NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by int4 NOT NULL,
    updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by int4 NOT NULL,
    archive bool DEFAULT false NOT NULL,
    CONSTRAINT gst_inward_supply_pk PRIMARY KEY (id),
    CONSTRAINT gst_inward_supply_business_fk FOREIGN KEY (business_id) REFERENCES public.business(id),
    CONSTRAINT gst_inward_supply_invoice_fk FOREIGN KEY (matched_invoice_id) REFERENCES public.purchase_invoice(id)
);
CREATE INDEX IF NOT EXISTS gst_inward_supply_period_idx ON public.gst_inward_supply(business_id, period);
CREATE INDEX IF NOT EXISTS gst_inward_supply_gstin_idx ON public.gst_inward_supply(supplier_gstin);
CREATE INDEX IF NOT EXISTS gst_inward_supply_batch_idx ON public.gst_inward_supply(import_batch);

CREATE TABLE IF NOT EXISTS public.gst_reconciliation (
    id serial4 NOT NULL,
    business_id int4 NOT NULL,
    period varchar(7) NOT NULL,
    purchase_invoice_id int4 NULL,
    inward_supply_id int4 NULL,
    match_type varchar NULL,
    status varchar NOT NULL DEFAULT 'MATCHED',
    variances jsonb NULL,
    resolution_note varchar NULL,
    resolved_by int4 NULL,
    resolved_at timestamptz NULL,
    active bool DEFAULT true NOT NULL,
    created_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by int4 NOT NULL,
    updated_on timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by int4 NOT NULL,
    archive bool DEFAULT false NOT NULL,
    CONSTRAINT gst_reconciliation_pk PRIMARY KEY (id),
    CONSTRAINT gst_reconciliation_business_fk FOREIGN KEY (business_id) REFERENCES public.business(id),
    CONSTRAINT gst_reconciliation_invoice_fk FOREIGN KEY (purchase_invoice_id) REFERENCES public.purchase_invoice(id),
    CONSTRAINT gst_reconciliation_inward_fk FOREIGN KEY (inward_supply_id) REFERENCES public.gst_inward_supply(id)
);
CREATE INDEX IF NOT EXISTS gst_reconciliation_period_idx ON public.gst_reconciliation(business_id, period);
CREATE INDEX IF NOT EXISTS gst_reconciliation_status_idx ON public.gst_reconciliation(status);
