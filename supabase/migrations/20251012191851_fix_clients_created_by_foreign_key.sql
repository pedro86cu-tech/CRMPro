/*
  # Fix clients table for external authentication

  1. Changes
    - Drop foreign key constraint on clients.created_by
    - Make created_by nullable to support external auth
    - This allows clients to be created without needing a profiles table entry
  
  2. Security
    - RLS is already disabled for external auth compatibility
    - System tracks creator ID but doesn't enforce referential integrity
  
  3. Notes
    - Works with external authentication systems
    - Creator tracking is maintained but not enforced
*/

-- Drop the foreign key constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'clients_created_by_fkey' 
    AND table_name = 'clients'
  ) THEN
    ALTER TABLE clients DROP CONSTRAINT clients_created_by_fkey;
  END IF;
END $$;

-- Make created_by nullable if it isn't already
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'clients' 
    AND column_name = 'created_by' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE clients ALTER COLUMN created_by DROP NOT NULL;
  END IF;
END $$;