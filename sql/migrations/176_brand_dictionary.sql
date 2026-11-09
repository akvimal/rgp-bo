-- 176: brand dictionary. A product gets a dosage form (so "same medicine" can mean the same form: a sustained-release tablet is not a plain tablet), and the app
-- gets a place for a reference list of brands with their composition, filled by an importer (api-v2/src/tools/import-drug-ref.ts). The list is shared reference
-- data, not a business's own: no business id. Where it comes from (the official CDCI Flat Files, or a canonical CSV) is recorded per import in drug_ref_source.
ALTER TABLE public.product ADD COLUMN IF NOT EXISTS dosage_form varchar(20) NULL;
ALTER TABLE public.product DROP CONSTRAINT IF EXISTS product_dosage_form_chk;
ALTER TABLE public.product ADD CONSTRAINT product_dosage_form_chk CHECK (dosage_form IS NULL OR dosage_form IN ('tablet', 'tablet_sr', 'tablet_dt', 'capsule', 'capsule_sr', 'syrup', 'drops', 'injection', 'topical', 'powder', 'inhaler', 'other'));

CREATE TABLE IF NOT EXISTS public.drug_ref_source (
    id serial4 PRIMARY KEY,
    kind varchar(12) NOT NULL,                  -- cdci (the official flat files), canonical (a prepared CSV), dev (test data on a developer's machine only)
    name varchar(120) NOT NULL,
    version varchar(60) NULL,
    row_count int4 NOT NULL DEFAULT 0,
    skipped_count int4 NOT NULL DEFAULT 0,
    active bool NOT NULL DEFAULT false,         -- the one the app reads
    imported_on timestamptz NOT NULL DEFAULT now(),
    imported_by varchar(80) NULL,
    note text NULL,
    CONSTRAINT drug_ref_source_kind_chk CHECK (kind IN ('cdci', 'canonical', 'dev'))
);
CREATE UNIQUE INDEX IF NOT EXISTS drug_ref_source_active_uq ON public.drug_ref_source (active) WHERE active;

CREATE TABLE IF NOT EXISTS public.drug_ref_brand (
    id bigserial PRIMARY KEY,
    source_id int4 NOT NULL REFERENCES public.drug_ref_source(id) ON DELETE CASCADE,
    brand varchar(200) NOT NULL,
    brand_key varchar(200) NOT NULL,            -- letters and digits only, lower case: what a typed name is looked up by
    manufacturer varchar(200) NOT NULL DEFAULT '',
    dosage_form varchar(20) NULL,
    form_text varchar(80) NOT NULL DEFAULT '',
    composition varchar(400) NOT NULL,
    composition_key varchar(400) NOT NULL,      -- the same key the shop's own compositions are compared by (composition-match.ts)
    salts_key varchar(400) NOT NULL,
    has_strength bool NOT NULL,
    pack varchar(80) NOT NULL DEFAULT '',
    discontinued bool NOT NULL DEFAULT false,
    code varchar(60) NOT NULL DEFAULT '',
    CONSTRAINT drug_ref_brand_form_chk CHECK (dosage_form IS NULL OR dosage_form IN ('tablet', 'tablet_sr', 'tablet_dt', 'capsule', 'capsule_sr', 'syrup', 'drops', 'injection', 'topical', 'powder', 'inhaler', 'other'))
);
CREATE INDEX IF NOT EXISTS drug_ref_brand_key_idx ON public.drug_ref_brand (brand_key text_pattern_ops);
CREATE INDEX IF NOT EXISTS drug_ref_brand_comp_idx ON public.drug_ref_brand (composition_key, dosage_form);
CREATE INDEX IF NOT EXISTS drug_ref_brand_source_idx ON public.drug_ref_brand (source_id);
