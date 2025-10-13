/*
  # Fix Calls Table and Add Recording Support

  1. Modifications
    - Add `recording_url` field for storing Twilio recording URL
    - Add `recording_sid` field for Twilio recording SID
    - Add `recording_duration` field for recording length
    - Ensure all required columns exist

  2. Notes
    - Uses caller_id instead of created_by for consistency
    - Supports complete call recording tracking
*/

-- Add recording-related columns
DO $$
BEGIN
  -- Add recording_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE calls ADD COLUMN recording_url text;
  END IF;

  -- Add recording_sid column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'recording_sid'
  ) THEN
    ALTER TABLE calls ADD COLUMN recording_sid text;
  END IF;

  -- Add recording_duration column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'recording_duration'
  ) THEN
    ALTER TABLE calls ADD COLUMN recording_duration integer DEFAULT 0;
  END IF;
END $$;

-- Create index for recording lookups
CREATE INDEX IF NOT EXISTS idx_calls_recording_sid ON calls(recording_sid);

-- Add comment for clarity
COMMENT ON COLUMN calls.recording_url IS 'URL to access the Twilio call recording';
COMMENT ON COLUMN calls.recording_sid IS 'Twilio Recording SID for reference';
COMMENT ON COLUMN calls.recording_duration IS 'Duration of the recording in seconds';