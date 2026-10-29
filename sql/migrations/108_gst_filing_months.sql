-- 108: the monthly GST routine: a month is closed when the return for it has been filed.
--  * gst_filing_month: the month's state (closed), when it was filed and the ARN, the HSN summary and the monthly summary as they stood at close (a later
--    correction of an HSN never changes a closed month), and the Business Head's acceptance of provisional HSN codes. A closed month takes no new tax invoice.
--  * gst_registration.hsn_digits: how many digits of HSN the return needs (4, 6 or 8; set by the Business Head).

CREATE TABLE IF NOT EXISTS public.gst_filing_month (
    business_id int4 NOT NULL,
    month char(7) NOT NULL,
    status varchar(8) NOT NULL DEFAULT 'CLOSED',
    filed_on date NULL,
    arn varchar(30) NULL,
    accepted_hsn boolean NOT NULL DEFAULT false,
    hsn_snapshot jsonb NULL,
    summary_snapshot jsonb NULL,
    closed_by int4 NULL,
    closed_on timestamptz NOT NULL DEFAULT now(),
    reopened_by int4 NULL,
    reopened_on timestamptz NULL,
    reopen_reason varchar(300) NULL,
    PRIMARY KEY (business_id, month),
    CONSTRAINT gst_filing_month_status_chk CHECK (status IN ('CLOSED', 'OPEN'))
);

ALTER TABLE public.gst_registration ADD COLUMN IF NOT EXISTS hsn_digits int4 NOT NULL DEFAULT 4;
ALTER TABLE public.gst_registration DROP CONSTRAINT IF EXISTS gst_registration_hsn_digits_chk;
ALTER TABLE public.gst_registration ADD CONSTRAINT gst_registration_hsn_digits_chk CHECK (hsn_digits IN (4, 6, 8));
