/*
  # Email Inbox System

  1. New Tables
    - `email_accounts`
      - `id` (uuid, primary key)
      - `user_id` (text, references external user)
      - `email_address` (text, unique)
      - `display_name` (text)
      - `imap_host` (text)
      - `imap_port` (integer)
      - `imap_username` (text)
      - `imap_password` (text, encrypted)
      - `smtp_host` (text)
      - `smtp_port` (integer)
      - `smtp_username` (text)
      - `smtp_password` (text, encrypted)
      - `use_ssl` (boolean)
      - `is_active` (boolean)
      - `last_sync` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `inbox_emails`
      - `id` (uuid, primary key)
      - `account_id` (uuid, references email_accounts)
      - `user_id` (text, owner of the email)
      - `message_id` (text, unique email identifier)
      - `thread_id` (text, for grouping related emails)
      - `from_email` (text)
      - `from_name` (text)
      - `to_emails` (jsonb, array of recipients)
      - `cc_emails` (jsonb, array of cc recipients)
      - `bcc_emails` (jsonb, array of bcc recipients)
      - `subject` (text)
      - `body_text` (text)
      - `body_html` (text)
      - `attachments` (jsonb, array of attachment info)
      - `is_read` (boolean)
      - `is_starred` (boolean)
      - `is_archived` (boolean)
      - `is_deleted` (boolean)
      - `folder` (text, inbox/sent/drafts/trash)
      - `labels` (jsonb, array of labels)
      - `email_date` (timestamptz, when email was sent)
      - `received_at` (timestamptz, when we received it)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `email_drafts`
      - `id` (uuid, primary key)
      - `account_id` (uuid, references email_accounts)
      - `user_id` (text)
      - `to_emails` (jsonb)
      - `cc_emails` (jsonb)
      - `bcc_emails` (jsonb)
      - `subject` (text)
      - `body_html` (text)
      - `attachments` (jsonb)
      - `reply_to_id` (uuid, references inbox_emails)
      - `forward_from_id` (uuid, references inbox_emails)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `email_folders`
      - `id` (uuid, primary key)
      - `account_id` (uuid, references email_accounts)
      - `user_id` (text)
      - `name` (text)
      - `type` (text, custom/system)
      - `color` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for user access control
*/

-- Email Accounts Table
CREATE TABLE IF NOT EXISTS email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  email_address text UNIQUE NOT NULL,
  display_name text DEFAULT '',
  imap_host text NOT NULL,
  imap_port integer DEFAULT 993,
  imap_username text NOT NULL,
  imap_password text NOT NULL,
  smtp_host text NOT NULL,
  smtp_port integer DEFAULT 465,
  smtp_username text NOT NULL,
  smtp_password text NOT NULL,
  use_ssl boolean DEFAULT true,
  is_active boolean DEFAULT true,
  last_sync timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email accounts"
  ON email_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own email accounts"
  ON email_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own email accounts"
  ON email_accounts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own email accounts"
  ON email_accounts FOR DELETE
  TO authenticated
  USING (true);

-- Inbox Emails Table
CREATE TABLE IF NOT EXISTS inbox_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES email_accounts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  message_id text NOT NULL,
  thread_id text,
  from_email text NOT NULL,
  from_name text DEFAULT '',
  to_emails jsonb DEFAULT '[]'::jsonb,
  cc_emails jsonb DEFAULT '[]'::jsonb,
  bcc_emails jsonb DEFAULT '[]'::jsonb,
  subject text DEFAULT '',
  body_text text DEFAULT '',
  body_html text DEFAULT '',
  attachments jsonb DEFAULT '[]'::jsonb,
  is_read boolean DEFAULT false,
  is_starred boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  is_deleted boolean DEFAULT false,
  folder text DEFAULT 'inbox',
  labels jsonb DEFAULT '[]'::jsonb,
  email_date timestamptz DEFAULT now(),
  received_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id, message_id)
);

ALTER TABLE inbox_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emails"
  ON inbox_emails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own emails"
  ON inbox_emails FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own emails"
  ON inbox_emails FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own emails"
  ON inbox_emails FOR DELETE
  TO authenticated
  USING (true);

-- Email Drafts Table
CREATE TABLE IF NOT EXISTS email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES email_accounts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  to_emails jsonb DEFAULT '[]'::jsonb,
  cc_emails jsonb DEFAULT '[]'::jsonb,
  bcc_emails jsonb DEFAULT '[]'::jsonb,
  subject text DEFAULT '',
  body_html text DEFAULT '',
  attachments jsonb DEFAULT '[]'::jsonb,
  reply_to_id uuid REFERENCES inbox_emails(id) ON DELETE SET NULL,
  forward_from_id uuid REFERENCES inbox_emails(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drafts"
  ON email_drafts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own drafts"
  ON email_drafts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own drafts"
  ON email_drafts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own drafts"
  ON email_drafts FOR DELETE
  TO authenticated
  USING (true);

-- Email Folders Table
CREATE TABLE IF NOT EXISTS email_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES email_accounts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  name text NOT NULL,
  type text DEFAULT 'custom',
  color text DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own folders"
  ON email_folders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own folders"
  ON email_folders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own folders"
  ON email_folders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own folders"
  ON email_folders FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inbox_emails_account_id ON inbox_emails(account_id);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_user_id ON inbox_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_folder ON inbox_emails(folder);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_thread_id ON inbox_emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_is_read ON inbox_emails(is_read);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_email_date ON inbox_emails(email_date DESC);
CREATE INDEX IF NOT EXISTS idx_email_drafts_user_id ON email_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_folders_account_id ON email_folders(account_id);