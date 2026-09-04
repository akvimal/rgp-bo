-- 027_rollback.sql

alter table public.purchase_invoice_item
    drop column if exists hsn,
    drop column if exists taxable_value,
    drop column if exists cgst_amount,
    drop column if exists sgst_amount,
    drop column if exists igst_amount,
    drop column if exists cess_amount;

alter table public.purchase_invoice
    drop column if exists supplier_gstin,
    drop column if exists place_of_supply,
    drop column if exists supply_type,
    drop column if exists invoice_type,
    drop column if exists reverse_charge,
    drop column if exists taxable_value,
    drop column if exists cgst_amount,
    drop column if exists sgst_amount,
    drop column if exists igst_amount,
    drop column if exists cess_amount,
    drop column if exists round_off,
    drop column if exists itc_eligibility,
    drop column if exists itc_reversal_amount,
    drop column if exists gst_recon_status,
    drop column if exists gst_period;

alter table public.business
    drop column if exists gstin,
    drop column if exists legal_name,
    drop column if exists state_code,
    drop column if exists address,
    drop column if exists pincode;
