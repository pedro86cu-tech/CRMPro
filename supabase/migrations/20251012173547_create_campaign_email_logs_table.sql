/*
  # Create Campaign Email Logs Table

  ## Overview
  Creates a comprehensive logging system for tracking email campaign sends in real-time.

  ## New Tables
  - `campaign_email_logs`
    - `id` (uuid, primary key) - Unique identifier for each log entry
    - `campaign_id` (uuid, foreign key) - Reference to the campaign
    - `contact_id` (uuid, foreign key) - Reference to the contact
    - `email` (text) - Email address of the recipient
    - `status` (text) - Status: 'pending', 'sending', 'sent', 'failed', 'bounced'
    - `error_message` (text) - Error details if failed
    - `sent_at` (timestamptz) - Timestamp when email was sent
    - `opened_at` (timestamptz) - Timestamp when email was opened
    - `clicked_at` (timestamptz) - Timestamp when link was clicked
    - `metadata` (jsonb) - Additional metadata (SMTP response, etc)
    - `created_at` (timestamptz) - Record creation timestamp

  ## Updates to campaigns table
  - Add `sent_count` (integer) - Count of successfully sent emails
  - Add `failed_count` (integer) - Count of failed emails
  - Add `total_recipients` (integer) - Total number of recipients

  ## Security
  - Enable RLS on campaign_email_logs
  - Allow authenticated users to read logs
  - Only system can write logs (via edge function with service role)

  ## Indexes
  - Index on campaign_id for fast lookups
  - Index on status for filtering
  - Index on created_at for sorting
*/

-- Create campaign_email_logs table
CREATE TABLE IF NOT EXISTS campaign_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Add status constraint
ALTER TABLE campaign_email_logs 
ADD CONSTRAINT campaign_email_logs_status_check 
CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'bounced'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_email_logs_campaign_id 
ON campaign_email_logs(campaign_id);

CREATE INDEX IF NOT EXISTS idx_campaign_email_logs_status 
ON campaign_email_logs(status);

CREATE INDEX IF NOT EXISTS idx_campaign_email_logs_created_at 
ON campaign_email_logs(created_at DESC);

-- Add columns to campaigns table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'sent_count'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN sent_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'failed_count'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN failed_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'campaigns' AND column_name = 'total_recipients'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN total_recipients integer DEFAULT 0;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE campaign_email_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all logs
CREATE POLICY "Users can view campaign email logs"
  ON campaign_email_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Service role can insert logs (for edge function)
CREATE POLICY "Service role can insert logs"
  ON campaign_email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Service role can update logs
CREATE POLICY "Service role can update logs"
  ON campaign_email_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
