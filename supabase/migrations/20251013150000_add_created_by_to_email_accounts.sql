/*
  # Add created_by column to email_accounts

  1. Changes
    - Add `created_by` column to email_accounts table
    - Populate from existing user_id if exists
    - Create index for performance
*/

-- Add created_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_accounts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE email_accounts ADD COLUMN created_by text;

    -- Copy user_id to created_by if user_id column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'email_accounts' AND column_name = 'user_id'
    ) THEN
      UPDATE email_accounts SET created_by = user_id WHERE created_by IS NULL;
    END IF;
  END IF;
END $$;

-- Create index for created_by
CREATE INDEX IF NOT EXISTS idx_email_accounts_created_by ON email_accounts(created_by);
