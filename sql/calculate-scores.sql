-- Calculate user performance scores for January 2026
-- Delete existing scores for January
DELETE FROM user_score WHERE score_date = '2026-01-01' AND score_period = 'MONTHLY';

-- Insert calculated scores
INSERT INTO user_score (
    user_id, score_date, score_period,
    attendance_score, punctuality_score, reliability_score, total_score, grade,
    total_working_days, present_days, absent_days, late_arrivals, calculated_on
)
SELECT
    u.id,
    DATE '2026-01-01',
    'MONTHLY',
    -- Attendance Score  (present / 8 * 100)
    (COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / 8)::NUMERIC(5,2),
    -- Punctuality Score (on-time / present * 100)
    CASE WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 555) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT'))::NUMERIC(5,2)
        ELSE 0 END,
    -- Reliability (70% attendance + 30% punctuality)
    ((COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / 8) * 0.7 +
     CASE WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 555) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
        ELSE 0 END)::NUMERIC(5,2),
    -- Total Score (50% attendance + 35% punctuality + 15% reliability)
    ((COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / 8) * 0.50 +
     CASE WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 555) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
        ELSE 0 END +
     ((COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / 8) * 0.7 +
      CASE WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
        THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 555) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
        ELSE 0 END) * 0.15)::NUMERIC(5,2),
    -- Grade
    CASE
        WHEN ((COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / 8) * 0.50 +
             CASE WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 555) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
                ELSE 0 END +
             ((COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / 8) * 0.7 +
              CASE WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 555) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                ELSE 0 END) * 0.15) >= 95 THEN 'A+'
        WHEN ((COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / 8) * 0.50 +
             CASE WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 555) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
                ELSE 0 END +
             ((COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / 8) * 0.7 +
              CASE WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 555) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                ELSE 0 END) * 0.15) >= 85 THEN 'A'
        WHEN ((COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / 8) * 0.50 +
             CASE WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 555) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.35
                ELSE 0 END +
             ((COUNT(*) FILTER (WHERE a.status = 'PRESENT') * 100.0 / 8) * 0.7 +
              CASE WHEN COUNT(*) FILTER (WHERE a.status = 'PRESENT') > 0
                THEN (COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) <= 555) * 100.0 / COUNT(*) FILTER (WHERE a.status = 'PRESENT')) * 0.3
                ELSE 0 END) * 0.15) >= 75 THEN 'B+'
        ELSE 'B' END,
    8,
    COUNT(*) FILTER (WHERE a.status = 'PRESENT'),
    COUNT(*) FILTER (WHERE a.status = 'ABSENT'),
    COUNT(*) FILTER (WHERE a.status = 'PRESENT' AND EXTRACT(HOUR FROM a.clock_in_time) * 60 + EXTRACT(MINUTE FROM a.clock_in_time) > 555),
    CURRENT_TIMESTAMP
FROM app_user u
JOIN attendance a ON u.id = a.user_id
WHERE u.active = true
  AND a.attendance_date >= '2026-01-01'
  AND a.attendance_date < '2026-02-01'
GROUP BY u.id;

-- Show performance leaderboard
SELECT
    ROW_NUMBER() OVER (ORDER BY us.total_score DESC) as rank,
    u.full_name as employee,
    us.total_score as score,
    us.grade,
    us.present_days,
    us.absent_days,
    us.late_arrivals
FROM user_score us
JOIN app_user u ON us.user_id = u.id
WHERE us.score_date = '2026-01-01'
  AND us.score_period = 'MONTHLY'
ORDER BY us.total_score DESC;

SELECT 'HR Dashboard Data Created Successfully!' as status;
