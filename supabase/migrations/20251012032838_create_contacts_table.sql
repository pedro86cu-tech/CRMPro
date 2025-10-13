/*
  # Create Contacts Table for Dynamic Campaign Data

  ## 1. New Tables
    - `contacts` - Store individual contacts
      - `id` (uuid, primary key)
      - `group_id` (uuid, foreign key to contact_groups)
      - `email` (text, required)
      - `first_name` (text)
      - `last_name` (text)
      - `company_name` (text)
      - `phone` (text)
      - `custom_fields` (jsonb) - For additional dynamic fields
      - `status` (text) - active, inactive, bounced, unsubscribed
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  ## 2. Security
    - Enable RLS on contacts table
    - Allow authenticated users to manage their contacts
*/

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES contact_groups(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text,
  last_name text,
  company_name text,
  phone text,
  custom_fields jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'bounced', 'unsubscribed')),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_group_id ON contacts(group_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

-- Add some sample contacts for testing
INSERT INTO contacts (group_id, email, first_name, last_name, company_name, phone, status)
SELECT 
  cg.id,
  'contacto' || generate_series(1, 5) || '@ejemplo.com',
  'Nombre' || generate_series(1, 5),
  'Apellido' || generate_series(1, 5),
  'Empresa ' || generate_series(1, 5),
  '+52 55 1234 567' || generate_series(1, 5),
  'active'
FROM contact_groups cg
LIMIT 5
ON CONFLICT DO NOTHING;