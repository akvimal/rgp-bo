-- 133: the patient and the prescriber for a scheduled drug are optional when completing a bill (pharmacy pack). "yes" brings back the block:
-- the bill cannot be completed without them. With "no" a bill completes without them, and the drug register lists the sale as missing its
-- details until a manager adds them there.
INSERT INTO public.app_setting (category, setting_key, setting_value, description)
SELECT 'pharmacy', 'schedule_register_enforce', 'no', 'yes = a bill with a scheduled drug cannot be completed without the patient and the prescriber. no = it can; the details are added later from the drug register.'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_setting WHERE setting_key = 'schedule_register_enforce');
