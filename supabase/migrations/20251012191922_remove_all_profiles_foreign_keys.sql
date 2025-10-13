/*
  # Remove all foreign key constraints to profiles table

  1. Changes
    - Drop all foreign key constraints that reference the profiles table
    - Make all related columns nullable
    - This enables the system to work with external authentication
  
  2. Tables affected
    - clients (assigned_to)
    - invoices (created_by)
    - calls (caller_id)
    - tickets (assigned_to, created_by)
    - ticket_comments (user_id)
    - client_interactions (created_by)
    - system_settings (updated_by)
  
  3. Security
    - RLS is already disabled for external auth compatibility
    - User tracking is maintained but not enforced with FK constraints
*/

-- Drop all foreign key constraints to profiles table
DO $$ 
BEGIN
  -- clients.assigned_to
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'clients_assigned_to_fkey' AND table_name = 'clients'
  ) THEN
    ALTER TABLE clients DROP CONSTRAINT clients_assigned_to_fkey;
  END IF;

  -- invoices.created_by
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'invoices_created_by_fkey' AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_created_by_fkey;
  END IF;

  -- calls.caller_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'calls_caller_id_fkey' AND table_name = 'calls'
  ) THEN
    ALTER TABLE calls DROP CONSTRAINT calls_caller_id_fkey;
  END IF;

  -- tickets.assigned_to
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tickets_assigned_to_fkey' AND table_name = 'tickets'
  ) THEN
    ALTER TABLE tickets DROP CONSTRAINT tickets_assigned_to_fkey;
  END IF;

  -- tickets.created_by
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tickets_created_by_fkey' AND table_name = 'tickets'
  ) THEN
    ALTER TABLE tickets DROP CONSTRAINT tickets_created_by_fkey;
  END IF;

  -- ticket_comments.user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ticket_comments_user_id_fkey' AND table_name = 'ticket_comments'
  ) THEN
    ALTER TABLE ticket_comments DROP CONSTRAINT ticket_comments_user_id_fkey;
  END IF;

  -- client_interactions.created_by
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'client_interactions_created_by_fkey' AND table_name = 'client_interactions'
  ) THEN
    ALTER TABLE client_interactions DROP CONSTRAINT client_interactions_created_by_fkey;
  END IF;

  -- system_settings.updated_by
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'system_settings_updated_by_fkey' AND table_name = 'system_settings'
  ) THEN
    ALTER TABLE system_settings DROP CONSTRAINT system_settings_updated_by_fkey;
  END IF;
END $$;

-- Make all user reference columns nullable
DO $$
BEGIN
  -- clients.assigned_to
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'assigned_to' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE clients ALTER COLUMN assigned_to DROP NOT NULL;
  END IF;

  -- invoices.created_by
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'created_by' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE invoices ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  -- calls.caller_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calls' AND column_name = 'caller_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE calls ALTER COLUMN caller_id DROP NOT NULL;
  END IF;

  -- tickets.assigned_to is already nullable

  -- tickets.created_by
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'created_by' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE tickets ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  -- ticket_comments.user_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_comments' AND column_name = 'user_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE ticket_comments ALTER COLUMN user_id DROP NOT NULL;
  END IF;

  -- client_interactions.created_by
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'client_interactions' AND column_name = 'created_by' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE client_interactions ALTER COLUMN created_by DROP NOT NULL;
  END IF;

  -- system_settings.updated_by is already nullable
END $$;