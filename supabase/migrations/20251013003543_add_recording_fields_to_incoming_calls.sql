/*
  # Add recording fields to incoming_calls table

  1. Changes
    - Add `recording_url` column to store the URL of the call recording
    - Add `recording_sid` column to store the Twilio recording SID
    
  2. Notes
    - These fields will be populated by the inbound webhook when recordings are available
    - Recordings are generated automatically by Twilio when calls are connected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incoming_calls' AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE incoming_calls ADD COLUMN recording_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incoming_calls' AND column_name = 'recording_sid'
  ) THEN
    ALTER TABLE incoming_calls ADD COLUMN recording_sid text;
  END IF;
END $$;