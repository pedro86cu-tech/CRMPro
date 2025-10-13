/*
  # Fix Contact Groups Created By Field

  1. Changes
    - Make `created_by` nullable in `contact_groups` table
    - Make `created_by` nullable in `campaigns` table
    - Make `created_by` nullable in `email_templates` table
    
  2. Reason
    - External authentication doesn't create profiles in auth.users
    - Users should still be able to create groups even without a profile
    
  3. Security
    - RLS policies remain unchanged
    - Data integrity is maintained
*/

-- Make created_by nullable in contact_groups
ALTER TABLE contact_groups 
  ALTER COLUMN created_by DROP NOT NULL;

-- Make created_by nullable in campaigns if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE campaigns 
      ALTER COLUMN created_by DROP NOT NULL;
  END IF;
END $$;

-- Make created_by nullable in email_templates if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'email_templates' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE email_templates 
      ALTER COLUMN created_by DROP NOT NULL;
  END IF;
END $$;
