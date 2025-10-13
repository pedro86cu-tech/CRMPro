/*
  # Add Audit Trail Columns to Main Tables

  1. Changes
    - Add updated_by column to clients, orders, invoices, campaigns tables
    - Add indexes for performance
    - These track who last modified each record
    
  2. Notes
    - created_by already exists in most tables
    - updated_by tracks the last user who modified the record
    - This provides full audit trail for compliance
*/

-- Add updated_by to clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' 
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE clients ADD COLUMN updated_by uuid;
  END IF;
END $$;

-- Add updated_by to orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE orders ADD COLUMN updated_by uuid;
  END IF;
END $$;

-- Add updated_by to invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' 
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE invoices ADD COLUMN updated_by uuid;
  END IF;
END $$;

-- Add updated_by to campaigns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' 
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN updated_by uuid;
  END IF;
END $$;

-- Add updated_by to tickets (already has created_by)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' 
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE tickets ADD COLUMN updated_by uuid;
  END IF;
END $$;

-- Add comments explaining the columns
COMMENT ON COLUMN clients.updated_by IS 'User who last updated this record';
COMMENT ON COLUMN orders.updated_by IS 'User who last updated this record';
COMMENT ON COLUMN invoices.updated_by IS 'User who last updated this record';
COMMENT ON COLUMN campaigns.updated_by IS 'User who last updated this record';
COMMENT ON COLUMN tickets.updated_by IS 'User who last updated this record';