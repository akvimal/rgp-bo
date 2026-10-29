-- Rollback 112: remove recognition badges and notes.
DROP TABLE IF EXISTS public.recognition_note;
DROP TABLE IF EXISTS public.recognition_award;
