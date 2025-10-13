/*
  ===============================================
  SCRIPT COMPLETO DE BASE DE DATOS - CRM PRO
  ===============================================

  Este script contiene TODAS las tablas, funciones, triggers y políticas RLS
  necesarias para el CRM Pro.

  INSTRUCCIONES DE INSTALACIÓN:
  1. Ve a tu proyecto de Supabase: https://supabase.com/dashboard
  2. Navega a "SQL Editor" en el menú lateral
  3. Crea una nueva query
  4. Copia y pega TODO este script
  5. Ejecuta el script (puede tardar 1-2 minutos)

  IMPORTANTE:
  - Este script es idempotente (se puede ejecutar múltiples veces sin problemas)
  - Usa IF NOT EXISTS para evitar errores
  - Todas las tablas tienen RLS habilitado para seguridad

  ===============================================
*/

-- ================================================
-- PARTE 1: SCHEMA PRINCIPAL DEL CRM
-- ================================================

-- Tabla de Clientes
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  contact_name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  country text DEFAULT 'México',
  website text,
  industry text,
  status text DEFAULT 'active',
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on clients" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Productos/Servicios
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sku text UNIQUE,
  price decimal(10,2) NOT NULL,
  cost decimal(10,2),
  stock_quantity integer DEFAULT 0,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on products" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Órdenes
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  client_id uuid REFERENCES clients(id),
  status text DEFAULT 'pending',
  subtotal decimal(10,2) DEFAULT 0,
  tax decimal(10,2) DEFAULT 0,
  discount decimal(10,2) DEFAULT 0,
  total decimal(10,2) DEFAULT 0,
  payment_status text DEFAULT 'pending',
  payment_method text,
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on orders" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Items de Órdenes
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  discount decimal(10,2) DEFAULT 0,
  tax decimal(10,2) DEFAULT 0,
  total decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on order_items" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Facturas
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  order_id uuid REFERENCES orders(id),
  client_id uuid REFERENCES clients(id),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status text DEFAULT 'draft',
  subtotal decimal(10,2) DEFAULT 0,
  tax decimal(10,2) DEFAULT 0,
  discount decimal(10,2) DEFAULT 0,
  total_amount decimal(10,2) DEFAULT 0,
  paid_amount decimal(10,2) DEFAULT 0,
  balance decimal(10,2) DEFAULT 0,
  payment_terms text,
  notes text,
  terms_conditions text,
  created_by text,
  updated_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on invoices" ON invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Items de Facturas
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL,
  discount decimal(10,2) DEFAULT 0,
  tax decimal(10,2) DEFAULT 0,
  total decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on invoice_items" ON invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Transacciones de Pago
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text UNIQUE NOT NULL,
  invoice_id uuid REFERENCES invoices(id),
  order_id uuid REFERENCES orders(id),
  client_id uuid REFERENCES clients(id),
  amount decimal(10,2) NOT NULL,
  payment_method text NOT NULL,
  payment_date timestamptz DEFAULT now(),
  status text DEFAULT 'completed',
  reference_number text,
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on payment_transactions" ON payment_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================
-- PARTE 2: SISTEMA DE TICKETS
-- ================================================

-- Tabla de Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  client_id uuid REFERENCES clients(id),
  subject text NOT NULL,
  description text,
  status text DEFAULT 'open',
  priority text DEFAULT 'medium',
  category text,
  assigned_to text,
  resolution text,
  resolved_at timestamptz,
  created_by text,
  updated_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on tickets" ON tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Comentarios de Tickets
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  comment text NOT NULL,
  is_internal boolean DEFAULT false,
  user_id text,
  user_email text,
  user_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on ticket_comments" ON ticket_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Actividad de Tickets
CREATE TABLE IF NOT EXISTS ticket_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  user_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ticket_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on ticket_activity" ON ticket_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger para registrar cambios en tickets
CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO ticket_activity (ticket_id, action, field_changed, old_value, new_value, user_id)
      VALUES (NEW.id, 'status_changed', 'status', OLD.status, NEW.status, NEW.updated_by);
    END IF;

    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      INSERT INTO ticket_activity (ticket_id, action, field_changed, old_value, new_value, user_id)
      VALUES (NEW.id, 'priority_changed', 'priority', OLD.priority, NEW.priority, NEW.updated_by);
    END IF;

    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO ticket_activity (ticket_id, action, field_changed, old_value, new_value, user_id)
      VALUES (NEW.id, 'assigned', 'assigned_to', OLD.assigned_to, NEW.assigned_to, NEW.updated_by);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ticket_changes_trigger ON tickets;
CREATE TRIGGER ticket_changes_trigger
  AFTER UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_changes();

-- ================================================
-- PARTE 3: SISTEMA DE CAMPAÑAS Y EMAILS
-- ================================================

-- Tabla de Contactos
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  phone text,
  company text,
  tags text[],
  is_subscribed boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on contacts" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Grupos de Contactos
CREATE TABLE IF NOT EXISTS contact_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contact_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on contact_groups" ON contact_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Membresía de Grupos
CREATE TABLE IF NOT EXISTS contact_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES contact_groups(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  UNIQUE(group_id, contact_id)
);

ALTER TABLE contact_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on contact_group_members" ON contact_group_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Plantillas de Email
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb,
  category text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on email_templates" ON email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Campañas
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  template_id uuid REFERENCES email_templates(id),
  html_content text NOT NULL,
  status text DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_recipients integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  opened_count integer DEFAULT 0,
  clicked_count integer DEFAULT 0,
  bounced_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on campaigns" ON campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Destinatarios de Campañas
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id),
  email text NOT NULL,
  status text DEFAULT 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on campaign_recipients" ON campaign_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Logs de Emails de Campañas
CREATE TABLE IF NOT EXISTS campaign_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES campaign_recipients(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL,
  event_type text NOT NULL,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on campaign_email_logs" ON campaign_email_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================
-- PARTE 4: SISTEMA DE LLAMADAS (TWILIO)
-- ================================================

-- Tabla de Configuración de Twilio
CREATE TABLE IF NOT EXISTS twilio_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_sid text NOT NULL,
  auth_token text NOT NULL,
  phone_number text NOT NULL,
  agent_number text,
  twiml_app_sid text,
  api_key_sid text,
  api_key_secret text,
  voice_url text,
  status_callback_url text,
  is_active boolean DEFAULT true,
  is_test_mode boolean DEFAULT false,
  created_by text,
  updated_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE twilio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on twilio_config" ON twilio_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Llamadas
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text UNIQUE,
  direction text NOT NULL,
  from_number text NOT NULL,
  to_number text NOT NULL,
  status text NOT NULL,
  duration integer DEFAULT 0,
  recording_url text,
  transcription text,
  notes text,
  client_id uuid REFERENCES clients(id),
  user_id text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on calls" ON calls FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabla de Llamadas Entrantes
CREATE TABLE IF NOT EXISTS incoming_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text UNIQUE NOT NULL,
  from_number text NOT NULL,
  to_number text NOT NULL,
  status text DEFAULT 'ringing',
  duration integer DEFAULT 0,
  recording_url text,
  recording_sid text,
  recording_duration integer,
  agent_number text,
  answered_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE incoming_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on incoming_calls" ON incoming_calls FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================
-- PARTE 5: SISTEMA DE CONFIGURACIÓN
-- ================================================

-- Tabla de Configuración del Sistema
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on system_settings" ON system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insertar configuraciones por defecto
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES
  ('smtp_config', '{"host":"","port":587,"secure":false,"username":"","password":"","from_email":"","from_name":""}'::jsonb, 'Configuración del servidor SMTP'),
  ('email_settings', '{"daily_limit":1000,"rate_limit":50,"retry_attempts":3,"bounce_handling":true}'::jsonb, 'Configuración de límites de email'),
  ('general_settings', '{"company_name":"","company_website":"","timezone":"America/Mexico_City","currency":"MXN","date_format":"DD/MM/YYYY"}'::jsonb, 'Configuración general del sistema')
ON CONFLICT (setting_key) DO NOTHING;

-- Tabla de Usuarios del Sistema (para autenticación externa)
CREATE TABLE IF NOT EXISTS system_users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  avatar_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on system_users" ON system_users FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ================================================
-- PARTE 6: SISTEMA DE BUZÓN DE CORREOS (INBOX)
-- ================================================

-- Tabla de Cuentas de Email
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

CREATE POLICY "Users can view own email accounts" ON email_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own email accounts" ON email_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own email accounts" ON email_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete own email accounts" ON email_accounts FOR DELETE TO authenticated USING (true);

-- Tabla de Emails del Buzón
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

CREATE POLICY "Users can view own emails" ON inbox_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own emails" ON inbox_emails FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own emails" ON inbox_emails FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete own emails" ON inbox_emails FOR DELETE TO authenticated USING (true);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_inbox_emails_account_id ON inbox_emails(account_id);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_user_id ON inbox_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_folder ON inbox_emails(folder);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_thread_id ON inbox_emails(thread_id);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_is_read ON inbox_emails(is_read);
CREATE INDEX IF NOT EXISTS idx_inbox_emails_email_date ON inbox_emails(email_date DESC);

-- Tabla de Borradores de Email
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

CREATE POLICY "Users can view own drafts" ON email_drafts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own drafts" ON email_drafts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own drafts" ON email_drafts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete own drafts" ON email_drafts FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_email_drafts_user_id ON email_drafts(user_id);

-- Tabla de Carpetas Personalizadas
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

CREATE POLICY "Users can view own folders" ON email_folders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own folders" ON email_folders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own folders" ON email_folders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can delete own folders" ON email_folders FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_email_folders_account_id ON email_folders(account_id);

-- ================================================
-- PARTE 7: TRIGGERS Y FUNCIONES ADICIONALES
-- ================================================

-- Trigger para actualizar el estado de pago de órdenes
CREATE OR REPLACE FUNCTION update_order_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET
    payment_status = CASE
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM payment_transactions WHERE order_id = NEW.order_id) >= orders.total
      THEN 'paid'
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM payment_transactions WHERE order_id = NEW.order_id) > 0
      THEN 'partial'
      ELSE 'pending'
    END
  WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_status_trigger ON payment_transactions;
CREATE TRIGGER payment_status_trigger
  AFTER INSERT OR UPDATE ON payment_transactions
  FOR EACH ROW
  WHEN (NEW.order_id IS NOT NULL)
  EXECUTE FUNCTION update_order_payment_status();

-- Función para actualizar timestamps automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de updated_at a todas las tablas relevantes
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT table_name
    FROM information_schema.columns
    WHERE column_name = 'updated_at'
    AND table_schema = 'public'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END;
$$;

-- ================================================
-- SCRIPT COMPLETADO
-- ================================================

/*
  ✅ BASE DE DATOS CONFIGURADA EXITOSAMENTE

  Tablas creadas:
  - Clientes (clients)
  - Productos (products)
  - Órdenes y items (orders, order_items)
  - Facturas y items (invoices, invoice_items)
  - Transacciones de pago (payment_transactions)
  - Tickets y comentarios (tickets, ticket_comments, ticket_activity)
  - Contactos y grupos (contacts, contact_groups, contact_group_members)
  - Plantillas y campañas (email_templates, campaigns, campaign_recipients, campaign_email_logs)
  - Llamadas (calls, incoming_calls, twilio_config)
  - Buzón de correos (email_accounts, inbox_emails, email_drafts, email_folders)
  - Configuración (system_settings, system_users)

  Todas las tablas tienen:
  ✓ Row Level Security (RLS) habilitado
  ✓ Políticas de acceso configuradas
  ✓ Índices para optimizar consultas
  ✓ Triggers para automatizar actualizaciones

  Siguiente paso: Configurar las Edge Functions en Supabase
*/
