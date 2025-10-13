/*
  # Remove Foreign Key for External Auth Compatibility

  1. Changes
    - Remove foreign key constraint between ticket_comments.user_id and system_users.id
    - This allows comments from external auth users without requiring sync
    
  2. Notes
    - Comments will store user_id from external auth system
    - User info will be joined when available, but not enforced
*/

-- Drop foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ticket_comments_user_id_fkey'
    AND table_name = 'ticket_comments'
  ) THEN
    ALTER TABLE ticket_comments DROP CONSTRAINT ticket_comments_user_id_fkey;
  END IF;
END $$;