/*
  # Create Twilio Configuration Table

  1. New Tables
    - `twilio_config`
      - `id` (uuid, primary key) - Unique identifier
      - `account_sid` (text) - Twilio Account SID
      - `auth_token` (text) - Twilio Auth Token (encrypted)
      - `phone_number` (text) - Twilio phone number for outbound calls
      - `twiml_app_sid` (text, optional) - TwiML Application SID for programmable voice
      - `api_key_sid` (text, optional) - API Key SID for enhanced security
      - `api_key_secret` (text, optional) - API Key Secret (encrypted)
      - `voice_url` (text, optional) - Webhook URL for voice calls
      - `status_callback_url` (text, optional) - Callback URL for call status updates
      - `is_active` (boolean) - Whether this configuration is active
      - `is_test_mode` (boolean) - Whether using test credentials
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `created_by` (text) - User who created the configuration
      - `updated_by` (text) - User who last updated the configuration

  2. Security
    - Disable RLS for external auth compatibility
    - Sensitive data like auth_token and api_key_secret should be encrypted at application level
    - Only store one active configuration at a time

  3. Important Notes
    - Account SID: Unique identifier for your Twilio account (starts with AC)
    - Auth Token: Secret token for API authentication
    - Phone Number: Must be in E.164 format (e.g., +15551234567)
    - TwiML App SID: For advanced programmable voice features (optional)
    - API Keys: Alternative to Auth Token for enhanced security (optional)
    - Test Mode: Allows using Twilio test credentials for development
*/

-- Create twilio_config table
CREATE TABLE IF NOT EXISTS twilio_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_sid text NOT NULL,
  auth_token text NOT NULL,
  phone_number text NOT NULL,
  twiml_app_sid text,
  api_key_sid text,
  api_key_secret text,
  voice_url text,
  status_callback_url text,
  is_active boolean DEFAULT true,
  is_test_mode boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,
  updated_by text,
  CONSTRAINT valid_phone_format CHECK (phone_number ~ '^\+[1-9]\d{1,14}$'),
  CONSTRAINT valid_account_sid CHECK (account_sid ~ '^AC[a-f0-9]{32}$')
);

-- Create index for active configuration lookup
CREATE INDEX IF NOT EXISTS idx_twilio_config_active ON twilio_config(is_active) WHERE is_active = true;

-- Disable RLS for external auth compatibility
ALTER TABLE twilio_config DISABLE ROW LEVEL SECURITY;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_twilio_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_twilio_config_updated_at
  BEFORE UPDATE ON twilio_config
  FOR EACH ROW
  EXECUTE FUNCTION update_twilio_config_updated_at();

-- Create function to ensure only one active configuration
CREATE OR REPLACE FUNCTION ensure_single_active_twilio_config()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE twilio_config
    SET is_active = false
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_active_twilio_config
  BEFORE INSERT OR UPDATE ON twilio_config
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_twilio_config();

-- Create call logs table for Twilio call history
CREATE TABLE IF NOT EXISTS twilio_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text UNIQUE NOT NULL,
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
  from_number text NOT NULL,
  to_number text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status text NOT NULL,
  duration integer DEFAULT 0,
  recording_url text,
  recording_sid text,
  error_code text,
  error_message text,
  price text,
  price_unit text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for call_sid lookup
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_sid ON twilio_call_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_twilio_call_logs_call_id ON twilio_call_logs(call_id);

-- Disable RLS for twilio_call_logs
ALTER TABLE twilio_call_logs DISABLE ROW LEVEL SECURITY;
