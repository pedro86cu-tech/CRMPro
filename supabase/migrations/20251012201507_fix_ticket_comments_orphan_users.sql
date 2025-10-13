/*
  # Fix Orphan Users in Ticket Comments

  1. Changes
    - Set user_id to NULL for comments with non-existent users
    - Add foreign key constraint between ticket_comments.user_id and system_users.id
    
  2. Notes
    - This preserves all comments but removes invalid user references
    - Future comments must reference valid system_users
*/

-- Make user_id nullable if it isn't already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_comments' 
    AND column_name = 'user_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE ticket_comments ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- Set user_id to NULL for comments with non-existent users
UPDATE ticket_comments
SET user_id = NULL
WHERE user_id IS NOT NULL
AND user_id NOT IN (SELECT id FROM system_users);

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ticket_comments_user_id_fkey'
    AND table_name = 'ticket_comments'
  ) THEN
    ALTER TABLE ticket_comments
    ADD CONSTRAINT ticket_comments_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES system_users(id)
    ON DELETE SET NULL;
  END IF;
END $$;