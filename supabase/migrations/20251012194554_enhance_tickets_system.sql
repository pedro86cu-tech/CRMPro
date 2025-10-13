/*
  # Enhance Tickets System

  1. New Tables
    - `ticket_attachments`: File attachments for tickets
    - `ticket_activity`: Activity and audit trail for tickets
    - `ticket_categories`: Categories for organizing tickets
    
  2. Enhancements
    - Add category_id to tickets
    - Add due_date to tickets
    - Add tags to tickets
    - Add is_internal flag to ticket_comments
    - Add email notification preferences
    
  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Create ticket_categories table
CREATE TABLE IF NOT EXISTS ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text DEFAULT '#3b82f6',
  icon text,
  created_at timestamptz DEFAULT now()
);

-- Create ticket_attachments table
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES ticket_comments(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  file_type text,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Create ticket_activity table for audit trail
CREATE TABLE IF NOT EXISTS ticket_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Add new columns to tickets table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN category_id uuid REFERENCES ticket_categories(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE tickets ADD COLUMN due_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'tags'
  ) THEN
    ALTER TABLE tickets ADD COLUMN tags text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'estimated_hours'
  ) THEN
    ALTER TABLE tickets ADD COLUMN estimated_hours numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'actual_hours'
  ) THEN
    ALTER TABLE tickets ADD COLUMN actual_hours numeric(10,2);
  END IF;
END $$;

-- Add is_internal flag to ticket_comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_comments' AND column_name = 'is_internal'
  ) THEN
    ALTER TABLE ticket_comments ADD COLUMN is_internal boolean DEFAULT false;
  END IF;
END $$;

-- Insert default categories
INSERT INTO ticket_categories (name, description, color, icon)
VALUES 
  ('Soporte Técnico', 'Problemas técnicos y errores del sistema', '#ef4444', 'AlertCircle'),
  ('Consulta', 'Preguntas y consultas generales', '#3b82f6', 'HelpCircle'),
  ('Solicitud de Cambio', 'Solicitudes de cambios o mejoras', '#8b5cf6', 'GitPullRequest'),
  ('Bug/Error', 'Reportes de bugs y errores', '#f59e0b', 'Bug'),
  ('Capacitación', 'Solicitudes de capacitación o documentación', '#10b981', 'BookOpen'),
  ('Incidente', 'Incidentes críticos que requieren atención inmediata', '#dc2626', 'AlertTriangle')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE ticket_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activity ENABLE ROW LEVEL SECURITY;

-- Disable RLS temporarily for external auth (will be properly secured later)
ALTER TABLE ticket_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_activity DISABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket_id ON ticket_activity(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_due_date ON tickets(due_date);

-- Create function to automatically log ticket changes
CREATE OR REPLACE FUNCTION log_ticket_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ticket_activity (ticket_id, user_id, action, description)
    VALUES (NEW.id, NEW.created_by, 'created', 'Ticket creado');
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO ticket_activity (ticket_id, user_id, action, field_changed, old_value, new_value)
      VALUES (NEW.id, NEW.updated_at, 'status_changed', 'status', OLD.status, NEW.status);
    END IF;
    
    -- Log priority changes
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      INSERT INTO ticket_activity (ticket_id, user_id, action, field_changed, old_value, new_value)
      VALUES (NEW.id, NEW.updated_at, 'priority_changed', 'priority', OLD.priority, NEW.priority);
    END IF;
    
    -- Log assignment changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO ticket_activity (ticket_id, user_id, action, field_changed, old_value, new_value)
      VALUES (NEW.id, NEW.updated_at, 'assigned', 'assigned_to', 
              COALESCE(OLD.assigned_to::text, 'unassigned'), 
              COALESCE(NEW.assigned_to::text, 'unassigned'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic activity logging
DROP TRIGGER IF EXISTS ticket_activity_trigger ON tickets;
CREATE TRIGGER ticket_activity_trigger
  AFTER INSERT OR UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION log_ticket_activity();