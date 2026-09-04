-- 027_gst_data_model.sql
-- WS-4 of docs/planning/PURCHASING_PAYABLES_GST_PROGRAM.md:
-- data model foundation for GSTR-2A/2B inward-supply reconciliation (WS-5).
-- Single-GSTIN-per-business assumption (decision #1, locked 2026-09-04).

-- business: legal/registration details needed on a GST invoice.
alter table public.business
    add column if not exists gstin varchar(15) null,
    add column if not exists legal_name varchar null,
    add column if not exists state_code varchar(2) null,
    add column if not exists address varchar null,
    add column if not exists pincode varchar(10) null;

-- purchase_invoice: header-level GST split + reconciliation status.
alter table public.purchase_invoice
    add column if not exists supplier_gstin varchar(15) null,
    add column if not exists place_of_supply varchar(2) null,
    add column if not exists supply_type varchar not null default 'INTRA',
    add column if not exists invoice_type varchar not null default 'REGULAR',
    add column if not exists reverse_charge boolean not null default false,
    add column if not exists taxable_value double precision null,
    add column if not exists cgst_amount double precision not null default 0,
    add column if not exists sgst_amount double precision not null default 0,
    add column if not exists igst_amount double precision not null default 0,
    add column if not exists cess_amount double precision not null default 0,
    add column if not exists round_off double precision not null default 0,
    add column if not exists itc_eligibility varchar not null default 'INPUTS',
    add column if not exists itc_reversal_amount double precision not null default 0,
    add column if not exists gst_recon_status varchar not null default 'UNRECONCILED',
    add column if not exists gst_period varchar(7) null;

-- purchase_invoice_item: line-level GST split, so header amounts can be summed from lines.
alter table public.purchase_invoice_item
    add column if not exists hsn varchar(40) null,
    add column if not exists taxable_value double precision null,
    add column if not exists cgst_amount double precision not null default 0,
    add column if not exists sgst_amount double precision not null default 0,
    add column if not exists igst_amount double precision not null default 0,
    add column if not exists cess_amount double precision not null default 0;

-- Backfill (existing rows only; new rows are computed by the app going forward).
-- Item-level: hsn from the product, tax split assuming intra-state (50/50 CGST/SGST) from
-- each line's own total + tax_pcnt (no invoice-level tax_pcnt exists to split from instead).
update public.purchase_invoice_item pii
set
    hsn = coalesce(pii.hsn, p.hsn_code),
    taxable_value = round((pii.total / (1 + coalesce(pii.tax_pcnt, 0) / 100.0))::numeric, 2),
    cgst_amount = round(((pii.total - (pii.total / (1 + coalesce(pii.tax_pcnt, 0) / 100.0))) / 2)::numeric, 2),
    sgst_amount = round(((pii.total - (pii.total / (1 + coalesce(pii.tax_pcnt, 0) / 100.0))) / 2)::numeric, 2)
from public.product p
where p.id = pii.product_id
  and pii.taxable_value is null
  and pii.total is not null;

-- Header-level: supplier GSTIN snapshot from the vendor, and the return period from the invoice date.
update public.purchase_invoice pi
set supplier_gstin = v.gstn
from public.vendor v
where v.id = pi.vendor_id
  and pi.supplier_gstin is null
  and v.gstn is not null
  and v.gstn <> '';

update public.purchase_invoice pi
set gst_period = to_char(pi.invoice_date, 'YYYY-MM')
where pi.gst_period is null
  and pi.invoice_date is not null;

-- Header-level: sum the (now backfilled) line splits up to the invoice.
update public.purchase_invoice pi
set
    taxable_value = agg.taxable_value,
    cgst_amount = agg.cgst_amount,
    sgst_amount = agg.sgst_amount
from (
    select invoice_id,
        sum(coalesce(taxable_value, 0)) as taxable_value,
        sum(coalesce(cgst_amount, 0)) as cgst_amount,
        sum(coalesce(sgst_amount, 0)) as sgst_amount
    from public.purchase_invoice_item
    where active = true and archive = false
    group by invoice_id
) agg
where agg.invoice_id = pi.id
  and pi.taxable_value is null;
