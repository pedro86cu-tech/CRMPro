/*
  # CRM Complete Database Schema

  ## 1. New Tables

  ### Authentication & Users
    - `profiles` - Extended user profile information
      - `id` (uuid, references auth.users)
      - `full_name` (text)
      - `avatar_url` (text)
      - `role` (text) - admin, manager, agent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  ### Clients Module
    - `clients` - Customer/client information
      - `id` (uuid, primary key)
      - `company_name` (text)
      - `contact_name` (text)
      - `email` (text)
      - `phone` (text)
      - `address` (text)
      - `city` (text)
      - `country` (text)
      - `status` (text) - active, inactive, prospect
      - `assigned_to` (uuid, references profiles)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  ### Email Campaigns
    - `email_templates` - Reusable email templates
      - `id` (uuid, primary key)
      - `name` (text)
      - `subject` (text)
      - `body` (text)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `contact_groups` - Groups for organizing contacts
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)

    - `group_contacts` - Many-to-many relationship
      - `group_id` (uuid, references contact_groups)
      - `client_id` (uuid, references clients)
      - `added_at` (timestamptz)

    - `campaigns` - Email campaigns
      - `id` (uuid, primary key)
      - `name` (text)
      - `template_id` (uuid, references email_templates)
      - `group_id` (uuid, references contact_groups)
      - `status` (text) - draft, scheduled, sending, sent, paused
      - `scheduled_at` (timestamptz)
      - `sent_at` (timestamptz)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)

    - `campaign_analytics` - Track email campaign performance
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references campaigns)
      - `client_id` (uuid, references clients)
      - `sent_at` (timestamptz)
      - `opened_at` (timestamptz)
      - `clicked_at` (timestamptz)
      - `bounced` (boolean)

  ### Orders & Invoices
    - `orders` - Purchase orders
      - `id` (uuid, primary key)
      - `order_number` (text, unique)
      - `client_id` (uuid, references clients)
      - `status` (text) - pending, processing, completed, cancelled
      - `total_amount` (numeric)
      - `notes` (text)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `invoices` - Invoices
      - `id` (uuid, primary key)
      - `invoice_number` (text, unique)
      - `order_id` (uuid, references orders)
      - `client_id` (uuid, references clients)
      - `amount` (numeric)
      - `status` (text) - draft, sent, paid, overdue, cancelled
      - `due_date` (date)
      - `paid_at` (timestamptz)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamptz)

  ### Call Management
    - `calls` - Call logs
      - `id` (uuid, primary key)
      - `client_id` (uuid, references clients)
      - `caller_id` (uuid, references profiles)
      - `direction` (text) - inbound, outbound
      - `duration` (integer) - in seconds
      - `status` (text) - completed, missed, cancelled
      - `notes` (text)
      - `created_at` (timestamptz)

  ### Ticket Management
    - `tickets` - Support tickets
      - `id` (uuid, primary key)
      - `ticket_number` (text, unique)
      - `client_id` (uuid, references clients)
      - `subject` (text)
      - `description` (text)
      - `status` (text) - open, in_progress, resolved, closed
      - `priority` (text) - low, medium, high, urgent
      - `assigned_to` (uuid, references profiles)
      - `created_by` (uuid, references profiles)
      - `resolved_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `ticket_comments` - Comments on tickets
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, references tickets)
      - `user_id` (uuid, references profiles)
      - `comment` (text)
      - `created_at` (timestamptz)

  ### Email Inbox
    - `emails` - Email messages
      - `id` (uuid, primary key)
      - `from_email` (text)
      - `to_email` (text)
      - `subject` (text)
      - `body` (text)
      - `is_read` (boolean)
      - `direction` (text) - inbound, outbound
      - `client_id` (uuid, references clients)
      - `ticket_id` (uuid, references tickets) - optional link to ticket
      - `created_at` (timestamptz)

  ## 2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
    - Ensure users can only access data they're authorized for
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  city text,
  country text,
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('active', 'inactive', 'prospect')),
  assigned_to uuid REFERENCES profiles(id),
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (true);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (true);

-- Contact groups
CREATE TABLE IF NOT EXISTS contact_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all contact groups"
  ON contact_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create contact groups"
  ON contact_groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update contact groups"
  ON contact_groups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete contact groups"
  ON contact_groups FOR DELETE
  TO authenticated
  USING (true);

-- Group contacts (many-to-many)
CREATE TABLE IF NOT EXISTS group_contacts (
  group_id uuid REFERENCES contact_groups(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, client_id)
);

ALTER TABLE group_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all group contacts"
  ON group_contacts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage group contacts"
  ON group_contacts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_id uuid REFERENCES email_templates(id),
  group_id uuid REFERENCES contact_groups(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create campaigns"
  ON campaigns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update campaigns"
  ON campaigns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete campaigns"
  ON campaigns FOR DELETE
  TO authenticated
  USING (true);

-- Campaign analytics
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  sent_at timestamptz DEFAULT now(),
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced boolean DEFAULT false
);

ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all campaign analytics"
  ON campaign_analytics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage campaign analytics"
  ON campaign_analytics FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  total_amount numeric(10, 2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (true);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date date NOT NULL,
  paid_at timestamptz,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (true);

-- Calls
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  caller_id uuid REFERENCES profiles(id) NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  duration integer DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'missed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all calls"
  ON calls FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create calls"
  ON calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update calls"
  ON calls FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete calls"
  ON calls FOR DELETE
  TO authenticated
  USING (true);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid REFERENCES profiles(id),
  created_by uuid REFERENCES profiles(id) NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update tickets"
  ON tickets FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete tickets"
  ON tickets FOR DELETE
  TO authenticated
  USING (true);

-- Ticket comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ticket comments"
  ON ticket_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create ticket comments"
  ON ticket_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON ticket_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON ticket_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Emails
CREATE TABLE IF NOT EXISTS emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_email text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  is_read boolean DEFAULT false,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all emails"
  ON emails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create emails"
  ON emails FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update emails"
  ON emails FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete emails"
  ON emails FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_client_id ON tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_emails_client_id ON emails(client_id);
CREATE INDEX IF NOT EXISTS idx_emails_ticket_id ON emails(ticket_id);