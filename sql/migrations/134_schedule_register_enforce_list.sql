-- 134: which schedules hold a bill back until the patient and the prescriber are given (pharmacy pack). The setting becomes a list, like
-- schedule_register_required: "H1,X" holds back H1 and X bills and leaves H optional. "yes" still means every schedule and "no" none.
-- Where the setting still has the "no" that migration 133 gave it, the default is now H1 and X.
UPDATE public.app_setting
   SET setting_value = 'H1,X',
       description = 'The schedules whose bills cannot be completed without the patient and the prescriber (a list such as H1,X). Other scheduled drugs can be completed and the details added later from the drug register. Empty = none.'
 WHERE setting_key = 'schedule_register_enforce' AND setting_value = 'no';
