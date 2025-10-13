/*
  # Enhance CRM with Advanced Features

  ## 1. Template Enhancements
    - Add HTML body support to email_templates
    - Add template variables system
    - Add template preview data
    
  ## 2. Enhanced Analytics Tables
    - Add detailed campaign tracking with metrics
    - Add client interaction history
    - Add revenue analytics
    - Add ticket SLA metrics

  ## 3. New Tables
    - `template_variables` - Define available variables for templates
    - `client_interactions` - Track all client interactions
    - `revenue_analytics` - Track revenue trends
    - `ticket_sla` - SLA tracking for tickets

  ## 4. Security
    - Enable RLS on all new tables
    - Add appropriate policies
*/

-- Add HTML body to email templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_templates' AND column_name = 'html_body'
  ) THEN
    ALTER TABLE email_templates ADD COLUMN html_body text;
    ALTER TABLE email_templates ADD COLUMN variables jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE email_templates ADD COLUMN preview_data jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Template variables
CREATE TABLE IF NOT EXISTS template_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key text NOT NULL UNIQUE,
  description text,
  default_value text,
  example text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE template_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all template variables"
  ON template_variables FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage template variables"
  ON template_variables FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Client interactions tracking
CREATE TABLE IF NOT EXISTS client_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'order', 'invoice')),
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE client_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all interactions"
  ON client_interactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create interactions"
  ON client_interactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Revenue analytics
CREATE TABLE IF NOT EXISTS revenue_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_revenue numeric(12, 2) DEFAULT 0,
  total_invoices integer DEFAULT 0,
  paid_invoices integer DEFAULT 0,
  pending_amount numeric(12, 2) DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE revenue_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view revenue analytics"
  ON revenue_analytics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage revenue analytics"
  ON revenue_analytics FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ticket SLA tracking
CREATE TABLE IF NOT EXISTS ticket_sla (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE UNIQUE,
  first_response_time interval,
  resolution_time interval,
  response_sla_met boolean DEFAULT false,
  resolution_sla_met boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ticket_sla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ticket SLA"
  ON ticket_sla FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage ticket SLA"
  ON ticket_sla FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_interactions_client_id ON client_interactions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_interactions_type ON client_interactions(type);
CREATE INDEX IF NOT EXISTS idx_client_interactions_created_at ON client_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_revenue_analytics_period ON revenue_analytics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_ticket_id ON ticket_sla(ticket_id);

-- Insert default template variables
INSERT INTO template_variables (name, key, description, default_value, example) VALUES
  ('Nombre del Cliente', 'client_name', 'Nombre completo del cliente', 'Cliente', 'Juan Pérez'),
  ('Empresa', 'company_name', 'Nombre de la empresa del cliente', 'Empresa', 'Acme Corp'),
  ('Email', 'client_email', 'Email del cliente', 'email@example.com', 'juan@acme.com'),
  ('Teléfono', 'client_phone', 'Teléfono del cliente', '+1234567890', '+52 555 1234'),
  ('Fecha Actual', 'current_date', 'Fecha actual del sistema', '2024-01-01', '15 de Octubre, 2025'),
  ('Nombre Empresa CRM', 'crm_company', 'Nombre de tu empresa', 'Mi Empresa', 'CRM Pro'),
  ('Número de Orden', 'order_number', 'Número de orden de compra', 'ORD-0000', 'ORD-1234'),
  ('Total Factura', 'invoice_total', 'Total de la factura', '$0.00', '$1,500.00'),
  ('Número Ticket', 'ticket_number', 'Número de ticket de soporte', 'TK-0000', 'TK-5678'),
  ('URL Empresa', 'company_url', 'URL de tu sitio web', 'https://ejemplo.com', 'https://crmpro.com')
ON CONFLICT (key) DO NOTHING;

-- Add campaign metrics to campaign_analytics
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_analytics' AND column_name = 'unique_opens'
  ) THEN
    ALTER TABLE campaign_analytics ADD COLUMN unique_opens integer DEFAULT 0;
    ALTER TABLE campaign_analytics ADD COLUMN total_clicks integer DEFAULT 0;
    ALTER TABLE campaign_analytics ADD COLUMN conversion boolean DEFAULT false;
  END IF;
END $$;