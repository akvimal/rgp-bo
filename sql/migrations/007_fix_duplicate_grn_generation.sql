-- Prevent PostgreSQL from caching sequence-backed GRN generation and repair
-- duplicates created by the previous IMMUTABLE function declaration.
BEGIN;

LOCK TABLE purchase_invoice IN SHARE ROW EXCLUSIVE MODE;

CREATE SEQUENCE IF NOT EXISTS public.grn_seq;

CREATE OR REPLACE FUNCTION public.generate_grn(prefix text)
RETURNS text
LANGUAGE sql
VOLATILE STRICT
AS $function$
    SELECT prefix
        || to_char(current_date, 'YYMM')
        || lpad(sequence_value, greatest(3, length(sequence_value)), '0')
    FROM (
        SELECT nextval('public.grn_seq')::text AS sequence_value
    ) generated;
$function$;

-- Keep the sequence ahead of both its current state and every generated GRN
-- already stored in purchase_invoice.
WITH sequence_state AS (
    SELECT last_value::bigint AS value
    FROM public.grn_seq
), existing_grns AS (
    SELECT max(
        (regexp_match(gr_no, '^.[0-9]{4}([0-9]+)$'))[1]::bigint
    ) AS value
    FROM purchase_invoice
    WHERE gr_no ~ '^.[0-9]{4}[0-9]+$'
)
SELECT setval(
    'public.grn_seq',
    greatest(
        coalesce(sequence_state.value, 1),
        coalesce(existing_grns.value, 1)
    ),
    true
)
FROM sequence_state, existing_grns;

-- Preserve the earliest invoice for each GRN and assign fresh GRNs to later
-- duplicates before enforcing uniqueness.
WITH duplicate_grns AS (
    SELECT id,
           gr_no,
           row_number() OVER (PARTITION BY gr_no ORDER BY id) AS occurrence
    FROM purchase_invoice
    WHERE gr_no IS NOT NULL
), duplicates_to_repair AS (
    SELECT id,
           gr_no,
           nextval('public.grn_seq')::text AS sequence_value
    FROM duplicate_grns
    WHERE occurrence > 1
)
UPDATE purchase_invoice invoice
SET gr_no = coalesce(nullif(left(duplicate.gr_no, 1), ''), 'R')
        || to_char(current_date, 'YYMM')
        || lpad(
            duplicate.sequence_value,
            greatest(3, length(duplicate.sequence_value)),
            '0'
        ),
    updated_on = current_timestamp
FROM duplicates_to_repair duplicate
WHERE invoice.id = duplicate.id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_invoice_gr_no_unique
    ON purchase_invoice (gr_no)
    WHERE gr_no IS NOT NULL;

COMMIT;
