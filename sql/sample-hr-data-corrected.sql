-- Sample HR Data for Dashboard (Corrected Schema)
-- Generated: 2026-01-13

-- ============================================
-- 1. CREATE SHIFTS
-- ============================================

INSERT INTO shift (name, start_time, end_time, description, active, archive, created_on, updated_on)
VALUES
('Morning Shift', '09:00', '18:00', 'Standard morning shift 9 AM to 6 PM', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Afternoon Shift', '14:00', '22:00', 'Afternoon shift 2 PM to 10 PM', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Evening Shift', '18:00', '02:00', 'Evening shift 6 PM to 2 AM', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (name, store_id) DO NOTHING;

-- ============================================
-- 2. ASSIGN SHIFTS TO USERS
-- ============================================

-- Assign Morning Shift to all users for weekdays
INSERT INTO user_shift (user_id, shift_id, effective_from, days_of_week, is_default, active, archive, created_on, updated_on)
SELECT
    u.id as user_id,
    s.id as shift_id,
    DATE '2026-01-01' as effective_from,
    '["MON", "TUE", "WED", "THU", "FRI"]'::jsonb as days_of_week,
    true as is_default,
    true as active,
    false as archive,
    CURRENT_TIMESTAMP as created_on,
    CURRENT_TIMESTAMP as updated_on
FROM app_user u
CROSS JOIN shift s
WHERE u.active = true
  AND u.archive = false
  AND s.name = 'Morning Shift'
  AND NOT EXISTS (
    SELECT 1 FROM user_shift us
    WHERE us.user_id = u.id AND us.shift_id = s.id
  );

-- ============================================
-- 3. CREATE LEAVE TYPES
-- ============================================

INSERT INTO leave_type (name, code, description, max_days_per_year, requires_document, is_paid, carry_forward, color_code, active, created_on, updated_on)
VALUES
('Casual Leave', 'CL', 'Leave for personal matters and emergencies', 12, false, true, true, '#4CAF50', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Sick Leave', 'SL', 'Leave for medical reasons and health issues', 10, true, true, false, '#FF9800', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Earned Leave', 'EL', 'Annual leave earned through service', 15, false, true, true, '#2196F3', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('Unpaid Leave', 'UL', 'Leave without pay', 0, false, false, false, '#9E9E9E', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 4. CREATE LEAVE BALANCES FOR 2026
-- ============================================

INSERT INTO leave_balance (user_id, leave_type_id, year, opening_balance, earned, used, balance, last_updated)
SELECT
    u.id as user_id,
    lt.id as leave_type_id,
    2026 as year,
    0 as opening_balance,
    lt.max_days_per_year as earned,
    0 as used,
    lt.max_days_per_year as balance,
    CURRENT_TIMESTAMP as last_updated
FROM app_user u
CROSS JOIN leave_type lt
WHERE u.active = true
  AND u.archive = false
  AND lt.active = true
  AND lt.max_days_per_year > 0
ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;

-- ============================================
-- 5. CREATE ATTENDANCE RECORDS FOR JANUARY 2026
-- ============================================

DO $$
DECLARE
    morning_shift_id INTEGER;
    user_record RECORD;
    attendance_date DATE;
    day_num INTEGER;
    status_val VARCHAR(20);
    clock_in TIMESTAMP WITH TIME ZONE;
    clock_out TIMESTAMP WITH TIME ZONE;
    late_minutes INTEGER;
BEGIN
    -- Get morning shift ID
    SELECT id INTO morning_shift_id FROM shift WHERE name = 'Morning Shift' LIMIT 1;

    IF morning_shift_id IS NULL THEN
        RAISE EXCEPTION 'Morning shift not found';
    END IF;

    -- Loop through each user
    FOR user_record IN
        SELECT id FROM app_user WHERE active = true AND archive = false
    LOOP
        -- Create attendance for workdays in January 2026 (up to today)
        FOR day_num IN 1..13 LOOP  -- January 1-13, 2026
            attendance_date := DATE '2026-01-01' + (day_num - 1);

            -- Skip weekends (0=Sunday, 6=Saturday)
            IF EXTRACT(DOW FROM attendance_date) NOT IN (0, 6) THEN

                -- Randomize attendance patterns
                CASE
                    WHEN day_num % 10 = 0 THEN
                        -- 10% absent
                        status_val := 'ABSENT';
                        clock_in := NULL;
                        clock_out := NULL;
                    WHEN day_num % 7 = 0 THEN
                        -- Some days late arrival
                        status_val := 'PRESENT';
                        late_minutes := 20 + (RANDOM() * 30)::INTEGER; -- 20-50 minutes late
                        clock_in := attendance_date + TIME '09:00:00' + (late_minutes || ' minutes')::INTERVAL;
                        clock_out := attendance_date + TIME '18:00:00' + ((RANDOM() * 30)::INTEGER || ' minutes')::INTERVAL;
                    ELSE
                        -- Regular attendance
                        status_val := 'PRESENT';
                        -- Slight variation in clock-in time (0-10 minutes)
                        late_minutes := (RANDOM() * 10)::INTEGER;
                        clock_in := attendance_date + TIME '09:00:00' + (late_minutes || ' minutes')::INTERVAL;
                        clock_out := attendance_date + TIME '18:00:00' + ((RANDOM() * 20)::INTEGER || ' minutes')::INTERVAL;
                END CASE;

                -- Insert attendance record
                INSERT INTO attendance (user_id, shift_id, attendance_date, clock_in_time, clock_out_time, status, active, archive, created_on, updated_on)
                VALUES (
                    user_record.id,
                    morning_shift_id,
                    attendance_date,
                    clock_in,
                    clock_out,
                    status_val,
                    true,
                    false,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (user_id, attendance_date) DO NOTHING;

            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- 6. CREATE USER PERFORMANCE SCORES FOR JANUARY 2026
-- ============================================

INSERT INTO user_score (
    user_id,
    score_date,
    score_period,
    attendance_score,
    punctuality_score,
    reliability_score,
    total_score,
    grade,
    total_working_days,
    present_days,
    absent_days,
    late_arrivals,
    calculated_on
)
SELECT
    u.id as user_id,
    DATE '2026-01-01' as score_date,
    'MONTHLY' as score_period,
    -- Attendance Score (present days / total working days * 100)
    CASE
        WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0
        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE))::NUMERIC(5,2)
        ELSE 0
    END as attendance_score,
    -- Punctuality Score (on-time arrivals / present days * 100)
    CASE
        WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT'))::NUMERIC(5,2)
        ELSE 0
    END as punctuality_score,
    -- Reliability Score (attendance score * 0.7 + punctuality score * 0.3)
    CASE
        WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0
        THEN (
            (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.7 +
            CASE
                WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                ELSE 0
            END
        )::NUMERIC(5,2)
        ELSE 0
    END as reliability_score,
    -- Total Score (weighted average: attendance 50%, punctuality 35%, reliability 15%)
    CASE
        WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0
        THEN (
            (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.50 +
            CASE
                WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
                ELSE 0
            END +
            CASE
                WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0
                THEN (
                    (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.7 +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                        ELSE 0
                    END
                ) * 0.15
                ELSE 0
            END
        )::NUMERIC(5,2)
        ELSE 0
    END as total_score,
    -- Grade based on total score
    CASE
        WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0 THEN
            CASE
                WHEN (
                    (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.50 +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
                        ELSE 0
                    END +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0
                        THEN (
                            (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.7 +
                            CASE
                                WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                                ELSE 0
                            END
                        ) * 0.15
                        ELSE 0
                    END
                ) >= 95 THEN 'A+'
                WHEN (
                    (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.50 +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
                        ELSE 0
                    END +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0
                        THEN (
                            (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.7 +
                            CASE
                                WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                                ELSE 0
                            END
                        ) * 0.15
                        ELSE 0
                    END
                ) >= 85 THEN 'A'
                WHEN (
                    (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.50 +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
                        ELSE 0
                    END +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0
                        THEN (
                            (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.7 +
                            CASE
                                WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                                ELSE 0
                            END
                        ) * 0.15
                        ELSE 0
                    END
                ) >= 75 THEN 'B+'
                WHEN (
                    (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.50 +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
                        ELSE 0
                    END +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0
                        THEN (
                            (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.7 +
                            CASE
                                WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                                ELSE 0
                            END
                        ) * 0.15
                        ELSE 0
                    END
                ) >= 65 THEN 'B'
                WHEN (
                    (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.50 +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
                        ELSE 0
                    END +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0
                        THEN (
                            (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.7 +
                            CASE
                                WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                                ELSE 0
                            END
                        ) * 0.15
                        ELSE 0
                    END
                ) >= 55 THEN 'C'
                WHEN (
                    (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.50 +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
                        ELSE 0
                    END +
                    CASE
                        WHEN COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) > 0
                        THEN (
                            (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE)) * 0.7 +
                            CASE
                                WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 9 * 60 + 15) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                                ELSE 0
                            END
                        ) * 0.15
                        ELSE 0
                    END
                ) >= 45 THEN 'D'
                ELSE 'F'
            END
        ELSE 'N/A'
    END as grade,
    COUNT(*) FILTER (WHERE a.attendance_date <= CURRENT_DATE) as total_working_days,
    COUNT(*) FILTER (WHERE a.status = 'PRESENT') as present_days,
    COUNT(*) FILTER (WHERE a.status = 'ABSENT') as absent_days,
    COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) > 9 * 60 + 15) as late_arrivals,
    CURRENT_TIMESTAMP as calculated_on
FROM app_user u
LEFT JOIN attendance a ON u.id = a.user_id
    AND a.attendance_date >= DATE '2026-01-01'
    AND a.attendance_date < DATE '2026-02-01'
    AND EXTRACT(DOW FROM a.attendance_date) NOT IN (0, 6)  -- Exclude weekends
WHERE u.active = true
  AND u.archive = false
GROUP BY u.id
ON CONFLICT (user_id, score_date, score_period) DO UPDATE
SET
    attendance_score = EXCLUDED.attendance_score,
    punctuality_score = EXCLUDED.punctuality_score,
    reliability_score = EXCLUDED.reliability_score,
    total_score = EXCLUDED.total_score,
    grade = EXCLUDED.grade,
    total_working_days = EXCLUDED.total_working_days,
    present_days = EXCLUDED.present_days,
    absent_days = EXCLUDED.absent_days,
    late_arrivals = EXCLUDED.late_arrivals,
    calculated_on = EXCLUDED.calculated_on;

-- ============================================
-- 7. CREATE SOME SAMPLE LEAVE REQUESTS
-- ============================================

INSERT INTO leave_request (
    user_id,
    leave_type_id,
    start_date,
    end_date,
    total_days,
    reason,
    status,
    active,
    created_on,
    updated_on
)
SELECT
    u.id as user_id,
    lt.id as leave_type_id,
    DATE '2026-01-20' as start_date,
    DATE '2026-01-21' as end_date,
    2 as total_days,
    'Personal work' as reason,
    'PENDING' as status,
    true as active,
    CURRENT_TIMESTAMP as created_on,
    CURRENT_TIMESTAMP as updated_on
FROM app_user u
CROSS JOIN leave_type lt
WHERE u.email = 'staff@rgp.com'
  AND lt.code = 'CL'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================
-- SUMMARY
-- ============================================

SELECT 'HR Sample Data Created Successfully!' as message;

SELECT
    'Shifts Created' as category,
    COUNT(*) as count
FROM shift
WHERE active = true;

SELECT
    'User Shifts Assigned' as category,
    COUNT(*) as count
FROM user_shift
WHERE active = true;

SELECT
    'Leave Types Created' as category,
    COUNT(*) as count
FROM leave_type
WHERE active = true;

SELECT
    'Leave Balances Created' as category,
    COUNT(*) as count
FROM leave_balance
WHERE year = 2026;

SELECT
    'Attendance Records Created' as category,
    COUNT(*) as count
FROM attendance
WHERE attendance_date >= DATE '2026-01-01'
  AND attendance_date < DATE '2026-02-01';

SELECT
    'User Scores Created' as category,
    COUNT(*) as count
FROM user_score
WHERE score_date = DATE '2026-01-01'
  AND score_period = 'MONTHLY';

SELECT
    'Leave Requests Created' as category,
    COUNT(*) as count
FROM leave_request
WHERE start_date >= DATE '2026-01-01';

-- Show performance scores
SELECT
    u.full_name,
    us.total_score::NUMERIC(5,2) as score,
    us.grade,
    us.present_days,
    us.absent_days,
    us.late_arrivals
FROM user_score us
JOIN app_user u ON us.user_id = u.id
WHERE us.score_date = DATE '2026-01-01'
  AND us.score_period = 'MONTHLY'
ORDER BY us.total_score DESC;
