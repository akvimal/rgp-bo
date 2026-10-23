-- 085: a purchase request can be for a product that is not in the product list yet. It carries the name that was typed until
-- purchasing links it to a product (or creates one); it cannot go on a purchase order before then. Rows already there all have a product.
ALTER TABLE public.purchase_request ADD COLUMN IF NOT EXISTS requested_name varchar(200) NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_request_product_or_name_chk') THEN
        ALTER TABLE public.purchase_request
            ADD CONSTRAINT purchase_request_product_or_name_chk CHECK (product_id IS NOT NULL OR requested_name IS NOT NULL) NOT VALID;
    END IF;
END $$;
