/*
  # Create System Users Table

  1. New Tables
    - `system_users`: Table to store application users for assignment purposes
    
  2. Changes
    - id: UUID primary key (matches external auth user ID)
    - email: User email address
    - full_name: User's full name
    - role: User role in the system (agent, manager, admin)
    - is_active: Whether user is active
    - avatar_url: Optional avatar image URL
    - created_at: Timestamp
    - updated_at: Timestamp
    
  3. Security
    - Disable RLS for external auth compatibility
*/

-- Create system_users table
CREATE TABLE IF NOT EXISTS system_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text DEFAULT 'agent',
  is_active boolean DEFAULT true,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_full_name ON system_users(full_name);
CREATE INDEX IF NOT EXISTS idx_system_users_is_active ON system_users(is_active);

-- Disable RLS for external auth
ALTER TABLE system_users DISABLE ROW LEVEL SECURITY;

-- Insert a default user (you can modify this later)
INSERT INTO system_users (email, full_name, role, is_active)
VALUES 
  ('admin@example.com', 'Administrador del Sistema', 'admin', true),
  ('soporte@example.com', 'Agente de Soporte', 'agent', true),
  ('manager@example.com', 'Gerente de Soporte', 'manager', true)
ON CONFLICT (email) DO NOTHING;