/*
  # Crear tabla de cola de comunicaciones de órdenes

  1. New Tables
    - `order_communications_queue`: Cola para procesar comunicaciones de órdenes
    - Guarda pending, processing, sent, error

  2. Security
    - Enable RLS
    - Allow all operations (será llamado por triggers)

  3. Indexes
    - Por order_id, status y created_at
*/

-- Crear tabla de cola de comunicaciones si no existe
CREATE TABLE IF NOT EXISTS order_communications_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  template_name text NOT NULL DEFAULT 'agenda_confirmation',
  recipient_email text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  error_message text,
  retry_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_order_communications_queue_order ON order_communications_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_order_communications_queue_status ON order_communications_queue(status);
CREATE INDEX IF NOT EXISTS idx_order_communications_queue_created ON order_communications_queue(created_at DESC);

-- RLS
ALTER TABLE order_communications_queue ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow all operations on order_communications_queue" ON order_communications_queue;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create policy
CREATE POLICY "Allow all operations on order_communications_queue"
  ON order_communications_queue
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Función simplificada
CREATE OR REPLACE FUNCTION trigger_send_order_communication()
RETURNS TRIGGER AS $$
DECLARE
  v_client_record RECORD;
  v_partner_record RECORD;
  v_order_items JSONB;
  v_payload JSONB;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    SELECT * INTO v_client_record
    FROM clients
    WHERE id = NEW.client_id;

    IF v_client_record.email IS NULL OR v_client_record.email = '' THEN
      RAISE NOTICE 'Cliente sin email';
      RETURN NEW;
    END IF;

    IF NEW.partner_id IS NOT NULL THEN
      SELECT * INTO v_partner_record
      FROM partners
      WHERE id = NEW.partner_id;
    END IF;

    SELECT jsonb_agg(
      jsonb_build_object(
        'description', description,
        'quantity', quantity,
        'unit_price', unit_price,
        'total', total_price
      )
    ) INTO v_order_items
    FROM order_items
    WHERE order_id = NEW.id;

    v_payload := jsonb_build_object(
      'client_name', COALESCE(v_client_record.contact_name, v_client_record.company_name),
      'order_number', NEW.order_number,
      'order_date', NEW.order_date,
      'total_amount', NEW.total_amount,
      'partner_name', COALESCE(v_partner_record.business_name, 'N/A'),
      'items', v_order_items
    );

    INSERT INTO order_communications_queue (
      order_id,
      template_name,
      recipient_email,
      payload,
      status
    ) VALUES (
      NEW.id,
      'agenda_confirmation',
      v_client_record.email,
      v_payload,
      'pending'
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_order_confirmed ON orders;

CREATE TRIGGER trigger_order_confirmed
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed'))
  EXECUTE FUNCTION trigger_send_order_communication();