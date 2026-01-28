-- Delete existing attendance for January 2026
DELETE FROM attendance WHERE attendance_date >= '2026-01-01' AND attendance_date < '2026-02-01';

-- Insert attendance for Admin (user_id=2) - 8 days, all present, all on time
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (2, 5, DATE '2026-01-02', TIMESTAMP '2026-01-02 09:05:00+00', TIMESTAMP '2026-01-02 18:10:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (2, 5, DATE '2026-01-03', TIMESTAMP '2026-01-03 09:02:00+00', TIMESTAMP '2026-01-03 18:15:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (2, 5, DATE '2026-01-06', TIMESTAMP '2026-01-06 09:00:00+00', TIMESTAMP '2026-01-06 18:05:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (2, 5, DATE '2026-01-07', TIMESTAMP '2026-01-07 09:10:00+00', TIMESTAMP '2026-01-07 18:20:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (2, 5, DATE '2026-01-08', TIMESTAMP '2026-01-08 09:03:00+00', TIMESTAMP '2026-01-08 18:12:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (2, 5, DATE '2026-01-09', TIMESTAMP '2026-01-09 09:01:00+00', TIMESTAMP '2026-01-09 18:08:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (2, 5, DATE '2026-01-10', TIMESTAMP '2026-01-10 09:00:00+00', TIMESTAMP '2026-01-10 18:00:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (2, 5, DATE '2026-01-13', TIMESTAMP '2026-01-13 09:05:00+00', TIMESTAMP '2026-01-13 18:15:00+00', 'PRESENT');

-- Insert attendance for Head (user_id=3) - 8 days, all present, one late (Jan 3 at 9:25 AM)
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (3, 5, DATE '2026-01-02', TIMESTAMP '2026-01-02 09:08:00+00', TIMESTAMP '2026-01-02 18:12:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (3, 5, DATE '2026-01-03', TIMESTAMP '2026-01-03 09:25:00+00', TIMESTAMP '2026-01-03 18:30:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (3, 5, DATE '2026-01-06', TIMESTAMP '2026-01-06 09:05:00+00', TIMESTAMP '2026-01-06 18:10:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (3, 5, DATE '2026-01-07', TIMESTAMP '2026-01-07 09:03:00+00', TIMESTAMP '2026-01-07 18:15:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (3, 5, DATE '2026-01-08', TIMESTAMP '2026-01-08 09:02:00+00', TIMESTAMP '2026-01-08 18:05:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (3, 5, DATE '2026-01-09', TIMESTAMP '2026-01-09 09:00:00+00', TIMESTAMP '2026-01-09 18:00:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (3, 5, DATE '2026-01-10', TIMESTAMP '2026-01-10 09:10:00+00', TIMESTAMP '2026-01-10 18:20:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (3, 5, DATE '2026-01-13', TIMESTAMP '2026-01-13 09:04:00+00', TIMESTAMP '2026-01-13 18:10:00+00', 'PRESENT');

-- Insert attendance for Staff (user_id=4) - 8 days, 7 present, 1 absent (Jan 6)
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (4, 5, DATE '2026-01-02', TIMESTAMP '2026-01-02 09:12:00+00', TIMESTAMP '2026-01-02 18:15:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (4, 5, DATE '2026-01-03', TIMESTAMP '2026-01-03 09:08:00+00', TIMESTAMP '2026-01-03 18:10:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (4, 5, DATE '2026-01-06', NULL, NULL, 'ABSENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (4, 5, DATE '2026-01-07', TIMESTAMP '2026-01-07 09:05:00+00', TIMESTAMP '2026-01-07 18:12:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (4, 5, DATE '2026-01-08', TIMESTAMP '2026-01-08 09:10:00+00', TIMESTAMP '2026-01-08 18:18:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (4, 5, DATE '2026-01-09', TIMESTAMP '2026-01-09 09:03:00+00', TIMESTAMP '2026-01-09 18:05:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (4, 5, DATE '2026-01-10', TIMESTAMP '2026-01-10 09:07:00+00', TIMESTAMP '2026-01-10 18:15:00+00', 'PRESENT');
INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status) VALUES (4, 5, DATE '2026-01-13', TIMESTAMP '2026-01-13 09:02:00+00', TIMESTAMP '2026-01-13 18:08:00+00', 'PRESENT');

-- Verify attendance summary
SELECT
    u.full_name,
    COUNT(*) as total_days,
    COUNT(*) FILTER(WHERE a.status='PRESENT') as present_days,
    COUNT(*) FILTER(WHERE a.status='ABSENT') as absent_days
FROM attendance a
JOIN app_user u ON a.user_id = u.id
WHERE a.attendance_date >= '2026-01-01'
GROUP BY u.full_name
ORDER BY u.full_name;
