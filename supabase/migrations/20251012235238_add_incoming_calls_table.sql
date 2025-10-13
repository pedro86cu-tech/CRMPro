/*
  # Add Incoming Calls Tracking Table
  
  1. New Table
    - `incoming_calls`
      - `id` (uuid, primary key)
      - `call_sid` (text, unique) - Twilio Call SID
      - `from_number` (text) - Número entrante
      - `to_number` (text) - Tu número Twilio
      - `status` (text) - Estado: ringing, answered, missed, rejected
      - `user_id` (text) - Usuario que debe recibir la notificación
      - `answered_by` (text) - Usuario que contestó
      - `answered_at` (timestamptz) - Momento en que fue contestada
      - `ended_at` (timestamptz) - Momento en que terminó
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Disable RLS (for external webhook access)
  
  3. Indexes
    - Index on call_sid for fast lookups
    - Index on status for filtering active calls
*/

CREATE TABLE IF NOT EXISTS incoming_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text UNIQUE NOT NULL,
  from_number text NOT NULL,
  to_number text NOT NULL,
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'answered', 'missed', 'rejected', 'ended')),
  user_id text,
  answered_by text,
  answered_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Disable RLS for webhook access
ALTER TABLE incoming_calls DISABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_incoming_calls_sid ON incoming_calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_incoming_calls_status ON incoming_calls(status);
CREATE INDEX IF NOT EXISTS idx_incoming_calls_user ON incoming_calls(user_id) WHERE status IN ('ringing', 'answered');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_incoming_calls_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_incoming_calls_timestamp
  BEFORE UPDATE ON incoming_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_incoming_calls_timestamp();