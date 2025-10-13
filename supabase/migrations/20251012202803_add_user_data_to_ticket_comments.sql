/*
  # Add User Data Columns to Ticket Comments

  1. Changes
    - Add user_name column to store the user's full name
    - Add user_email column to store the user's email
    - These columns denormalize data for external auth compatibility
    
  2. Notes
    - user_id remains for reference but is not enforced with FK
    - user_name and user_email are populated from external auth data
    - This approach avoids join issues with external auth systems
*/

-- Add user_name column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_comments' 
    AND column_name = 'user_name'
  ) THEN
    ALTER TABLE ticket_comments ADD COLUMN user_name text;
  END IF;
END $$;

-- Add user_email column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_comments' 
    AND column_name = 'user_email'
  ) THEN
    ALTER TABLE ticket_comments ADD COLUMN user_email text;
  END IF;
END $$;