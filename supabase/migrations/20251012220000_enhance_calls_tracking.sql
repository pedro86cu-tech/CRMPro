/*
  # Enhance Calls Tracking System

  1. Modifications to `calls` table
    - Add `phone_number` field for storing the dialed number
    - Add `started_at` field for call start timestamp
    - Add `ended_at` field for call end timestamp
    - Add `outcome` field for call result (answered, no_answer, voicemail, busy)
    - Add `status` field for call status (in_progress, completed, failed)
    - Modify `duration` to store seconds instead of optional value

  2. Important Notes
    - Preserves existing data
    - Adds fields that support complete call lifecycle tracking
    - Enables integration with call management modal
    - Supports ticket creation from calls
*/

-- Add new columns if they don't exist
DO $$
BEGIN
  -- Add phone_number column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE calls ADD COLUMN phone_number text;
  END IF;

  -- Add started_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE calls ADD COLUMN started_at timestamptz;
  END IF;

  -- Add ended_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'ended_at'
  ) THEN
    ALTER TABLE calls ADD COLUMN ended_at timestamptz;
  END IF;

  -- Add outcome column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'outcome'
  ) THEN
    ALTER TABLE calls ADD COLUMN outcome text CHECK (outcome IN ('answered', 'no_answer', 'voicemail', 'busy'));
  END IF;

  -- Add status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'status'
  ) THEN
    ALTER TABLE calls ADD COLUMN status text DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed'));
  END IF;

  -- Modify duration column to integer if it's not already
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'duration' AND data_type != 'integer'
  ) THEN
    ALTER TABLE calls ALTER COLUMN duration TYPE integer USING COALESCE(duration::integer, 0);
    ALTER TABLE calls ALTER COLUMN duration SET DEFAULT 0;
  END IF;
END $$;

-- Create index for performance on phone_number lookups
CREATE INDEX IF NOT EXISTS idx_calls_phone_number ON calls(phone_number);

-- Create index for status-based queries
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at);
