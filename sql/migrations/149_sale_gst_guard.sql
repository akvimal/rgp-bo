-- 149: the server refuses to complete a bill whose lines carry a GST rate other than the one in force today for that product
-- (GST > Rate changes, else the batch's own rate), and sends back the lines with today's rate so the till can correct them.
-- 'on' (default) refuses; 'off' lets the bill through as it was sent.
INSERT INTO public.app_setting (category, setting_key, setting_value, description, active, archive, created_by, updated_by)
VALUES ('pricing', 'sale_gst_guard', 'on', 'on: refuse a completed bill line that does not carry the GST rate in force today; off: accept the rate sent', true, false, 1, 1)
ON CONFLICT (setting_key) DO NOTHING;
