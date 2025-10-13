/*
  # Add call_sid column to calls table
  
  1. Changes
    - Add `call_sid` column to `calls` table
      - Stores Twilio Call SID for tracking
      - Optional (nullable) as not all calls may have it initially
      - Add index for fast lookups
  
  2. Notes
    - This column links calls to Twilio's system
    - Used to fetch recordings and call status
*/

-- Add call_sid column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'call_sid'
  ) THEN
    ALTER TABLE calls ADD COLUMN call_sid text;
  END IF;
END $$;

-- Create index for fast lookups by call_sid
CREATE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid) WHERE call_sid IS NOT NULL;