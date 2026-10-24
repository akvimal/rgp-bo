-- 088: the opening, handover and closing checklists belong to the business, with an optional list of their own for a store.
-- A row is a whole list (items is [{key, label}]); no row means the standard list in the code. store_id empty: the business's list.
CREATE TABLE IF NOT EXISTS public.shift_checklist (
    id serial4 PRIMARY KEY,
    business_id int4 NOT NULL REFERENCES public.business(id) ON DELETE CASCADE,
    store_id int4 NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    kind varchar(24) NOT NULL,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_on timestamptz NOT NULL DEFAULT now(),
    updated_by int4 NULL,
    CONSTRAINT shift_checklist_kind_chk CHECK (kind IN ('OPENING', 'OPENING_OPEN_STORE', 'CLOSING', 'HANDOVER'))
);
CREATE UNIQUE INDEX IF NOT EXISTS shift_checklist_scope_uq ON public.shift_checklist (business_id, coalesce(store_id, 0), kind);
