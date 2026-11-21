-- 234: price lists kept for comparing the shop's MRP and selling prices: the PMBI Jan Aushadhi list (from its PDF) and other competitors' lists (CSV / Excel).
-- Shared reference data, no business id. Each list has its own name; loading a list with a name already in use replaces that list, other lists stay.
-- Each item keeps the composition (for matching with the shop's products), its dosage form, the pack, the MRP and, where the list has one, the selling price.
CREATE TABLE IF NOT EXISTS public.price_ref_source (
  id             serial PRIMARY KEY,
  kind           varchar(20) NOT NULL,           -- 'PMBI' (the Jan Aushadhi PDF) or 'COMPETITOR' (a CSV / Excel list)
  name           varchar(200) NOT NULL,          -- the list's name, as shown: "PMBI Jan Aushadhi", "Apollo Pharmacy"
  version        varchar(60),                    -- the date or edition of the list
  row_count      int4 NOT NULL,
  skipped_count  int4 NOT NULL DEFAULT 0,        -- rows left out (for example an MRP of 0)
  imported_by    varchar(100),
  imported_on    timestamp NOT NULL DEFAULT now(),
  note           text
);
CREATE UNIQUE INDEX IF NOT EXISTS price_ref_source_name_uq ON public.price_ref_source (lower(name));

CREATE TABLE IF NOT EXISTS public.price_ref_item (
  id               serial PRIMARY KEY,
  source_id        int4 NOT NULL REFERENCES public.price_ref_source(id) ON DELETE CASCADE,
  sr               int4,
  code             varchar(40),
  name             varchar(300) NOT NULL,        -- the product or generic name as in the list
  unit_size        varchar(60),                  -- as in the list: 10's, 15 g, 60 ml, Vial & Wfi
  pack_qty         numeric(12,2),                -- the number in it, when there is one
  pack_kind        varchar(10) NOT NULL DEFAULT 'other',   -- units | ml | g | other
  mrp              numeric(12,2) NOT NULL,       -- for that pack
  sell_price       numeric(12,2),                -- what the list sells it at, for that pack (none in the PMBI list)
  composition      text,                         -- "Aceclofenac 100 mg + Paracetamol 325 mg"
  composition_key  text,
  salts_key        text,
  has_strength     boolean NOT NULL DEFAULT false,
  dosage_form      varchar(40)
);
CREATE INDEX IF NOT EXISTS price_ref_item_key_idx ON public.price_ref_item (composition_key);
CREATE INDEX IF NOT EXISTS price_ref_item_source_idx ON public.price_ref_item (source_id);
