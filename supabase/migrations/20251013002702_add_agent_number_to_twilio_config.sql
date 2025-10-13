/*
  # Add agent number to Twilio configuration

  1. Changes
    - Add `agent_number` column to store the phone number where agents receive incoming calls
    
  2. Notes
    - This is the number that will be called when an agent answers an incoming call
    - Should be in E.164 format (e.g., +525512345678)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'twilio_config' AND column_name = 'agent_number'
  ) THEN
    ALTER TABLE twilio_config ADD COLUMN agent_number text;
  END IF;
END $$;