/*
  # Make company_name optional for individual clients

  1. Changes
    - Allow `company_name` to be NULL in the `clients` table
    - This enables support for both B2B (company clients) and B2C (individual person clients)
  
  2. Notes
    - Clients must have at least a contact_name or company_name
    - Individual clients (B2C) can leave company_name empty
    - Business clients (B2B) should fill both fields
*/

-- Make company_name nullable to support individual clients
ALTER TABLE clients 
ALTER COLUMN company_name DROP NOT NULL;

-- Add a check constraint to ensure at least one name is provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'clients_name_check'
  ) THEN
    ALTER TABLE clients 
    ADD CONSTRAINT clients_name_check 
    CHECK (
      (company_name IS NOT NULL AND company_name <> '') 
      OR 
      (contact_name IS NOT NULL AND contact_name <> '')
    );
  END IF;
END $$;