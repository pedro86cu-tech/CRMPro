/*
  # Add User Ownership to Emails

  1. Changes
    - Add user_id column to emails table to track which user owns/can see each email
    - Add updated_by column for audit trail
    - Add index for performance on user_id queries
    
  2. Notes
    - user_id represents the user who received/sent the email
    - For inbox filtering, only show emails where user_id matches current user
*/

-- Add user_id column for email ownership
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emails' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE emails ADD COLUMN user_id uuid;
  END IF;
END $$;

-- Add updated_by column for audit trail
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emails' 
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE emails ADD COLUMN updated_by uuid;
  END IF;
END $$;

-- Add index for performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_emails_user_id'
  ) THEN
    CREATE INDEX idx_emails_user_id ON emails(user_id);
  END IF;
END $$;

-- Add comment explaining the column
COMMENT ON COLUMN emails.user_id IS 'The user who owns this email (sent or received it)';