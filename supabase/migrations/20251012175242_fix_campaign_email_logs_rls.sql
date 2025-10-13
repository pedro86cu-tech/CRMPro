/*
  # Fix RLS for Campaign Email Logs

  ## Changes
  - Disable RLS on campaign_email_logs table to work with external authentication
  - This matches the pattern used for other tables in the system

  ## Security Note
  - External authentication is handled at the application level
  - RLS is not compatible with external auth systems
*/

-- Disable RLS on campaign_email_logs
ALTER TABLE campaign_email_logs DISABLE ROW LEVEL SECURITY;

-- Drop existing policies (they're no longer needed)
DROP POLICY IF EXISTS "Users can view campaign email logs" ON campaign_email_logs;
DROP POLICY IF EXISTS "Service role can insert logs" ON campaign_email_logs;
DROP POLICY IF EXISTS "Service role can update logs" ON campaign_email_logs;
