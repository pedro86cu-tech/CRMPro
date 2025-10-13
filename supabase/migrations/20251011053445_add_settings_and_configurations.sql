/*
  # Add Settings and Configuration Tables

  ## 1. New Tables
    - `system_settings` - Store system-wide configuration
      - SMTP settings
      - Email configuration
      - General settings
      - Integration settings
    
  ## 2. Security
    - Enable RLS on settings table
    - Only authenticated users can view settings
    - Only admins can modify settings
*/

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  setting_type text NOT NULL CHECK (setting_type IN ('smtp', 'email', 'general', 'integration')),
  description text,
  updated_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage system settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default SMTP settings
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
  ('smtp_config', '{
    "host": "",
    "port": 587,
    "secure": false,
    "username": "",
    "password": "",
    "from_email": "",
    "from_name": ""
  }'::jsonb, 'smtp', 'SMTP server configuration for sending emails'),
  
  ('email_settings', '{
    "daily_limit": 1000,
    "rate_limit": 50,
    "retry_attempts": 3,
    "bounce_handling": true
  }'::jsonb, 'email', 'Email sending limits and settings'),
  
  ('general_settings', '{
    "company_name": "Mi Empresa",
    "company_website": "https://ejemplo.com",
    "timezone": "America/Mexico_City",
    "currency": "MXN",
    "date_format": "DD/MM/YYYY"
  }'::jsonb, 'general', 'General system settings'),
  
  ('integration_settings', '{
    "webhooks_enabled": false,
    "api_enabled": true,
    "third_party_integrations": []
  }'::jsonb, 'integration', 'Integration and API settings')
ON CONFLICT (setting_key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_type ON system_settings(setting_type);