-- Migration 016: Fix Intent Number Generation Function
-- This migration fixes the generate_intent_number() function to avoid the
-- "FOR UPDATE is not allowed with aggregate functions" error

-- Drop the existing function
DROP FUNCTION IF EXISTS generate_intent_number();

-- Create fixed version using advisory lock
CREATE OR REPLACE FUNCTION generate_intent_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    current_year TEXT;
    sequence_num INTEGER;
    new_intent_no VARCHAR(20);
    lock_key BIGINT;
BEGIN
    -- Use advisory lock to prevent race conditions
    -- Lock key: hash of 'intent_number_generation'
    lock_key := hashtext('intent_number_generation');

    -- Acquire advisory lock (will wait if another transaction has it)
    PERFORM pg_advisory_xact_lock(lock_key);

    -- Get current year
    current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    -- Get next sequence number for this year (without FOR UPDATE on aggregate)
    SELECT COALESCE(MAX(CAST(SUBSTRING(intentno FROM 10) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM sales_intent
    WHERE intentno LIKE 'INT-' || current_year || '-%';

    -- Generate intent number: INT-YYYY-001
    new_intent_no := 'INT-' || current_year || '-' || LPAD(sequence_num::TEXT, 3, '0');

    -- Advisory lock will be automatically released at transaction end
    RETURN new_intent_no;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION generate_intent_number() IS
'Generates sequential intent numbers in format INT-YYYY-NNN using advisory locks to prevent race conditions';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 016: Fixed generate_intent_number() function';
  RAISE NOTICE 'Changed from row-level locking to advisory locks to avoid aggregate function error';
END $$;
