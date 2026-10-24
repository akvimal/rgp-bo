-- 089: what was ticked when a shift was opened and closed: the list as it stood (each item with its wording), who did it, and when each
-- item was ticked. One record per shift and phase. The wording is kept as it was, so changing a checklist later does not rewrite the past.
CREATE TABLE IF NOT EXISTS public.shift_checklist_log (
    id serial4 PRIMARY KEY,
    shift_id int4 NOT NULL REFERENCES public.store_shifts(id) ON DELETE CASCADE,
    phase varchar(5) NOT NULL,
    kind varchar(24) NOT NULL,
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    done_by int4 NULL,
    operator_id int4 NULL,
    done_on timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT shift_checklist_log_phase_chk CHECK (phase IN ('OPEN', 'CLOSE')),
    CONSTRAINT shift_checklist_log_uq UNIQUE (shift_id, phase)
);
