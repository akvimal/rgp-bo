-- 237: a dose and a number of days on each Counter guide option, written the way the counter reads it: "1 (bf) - 0 - 1 (af)" is one in the morning before food,
-- none at noon, one at night after food (bf = before food, af = after food). A dose that is not morning / noon / night (ORS after each loose motion, a cream
-- twice a day) is written in words. Doses are the pharmacist's content like the rest of a card: a card still needs approving.
ALTER TABLE public.guide_option ADD COLUMN IF NOT EXISTS dose varchar(120);
ALTER TABLE public.guide_option ADD COLUMN IF NOT EXISTS days int4;
