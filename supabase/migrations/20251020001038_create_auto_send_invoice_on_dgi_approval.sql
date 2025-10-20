/*
  # Trigger automático para enviar factura por email al aprobar DGI

  1. Nueva tabla para cola de emails
    - `invoice_email_queue` - Cola de facturas pendientes de envío
    - Almacena invoice_id y prioridad
    
  2. Función trigger
    - Se ejecuta cuando dgi_estado cambia a 'aprobado'
    - Agrega la factura a la cola de emails
    - El frontend/worker procesa la cola
    
  3. Nota importante
    - Los triggers no pueden llamar directamente a edge functions HTTP
    - Usamos una tabla de cola que el sistema procesa
*/

-- Crear tabla de cola de emails de facturas
CREATE TABLE IF NOT EXISTS invoice_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  priority int DEFAULT 1,
  attempts int DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_invoice_email_queue_status ON invoice_email_queue(status);
CREATE INDEX IF NOT EXISTS idx_invoice_email_queue_invoice_id ON invoice_email_queue(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_email_queue_created_at ON invoice_email_queue(created_at);

-- Habilitar RLS
ALTER TABLE invoice_email_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Permitir lectura autenticada"
  ON invoice_email_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserción autenticada"
  ON invoice_email_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir actualización autenticada"
  ON invoice_email_queue FOR UPDATE
  TO authenticated
  USING (true);

-- Función que agrega factura a cola de emails cuando es aprobada por DGI
CREATE OR REPLACE FUNCTION queue_invoice_email_on_dgi_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Si dgi_estado cambió a 'aprobado'
  IF NEW.dgi_estado = 'aprobado' AND (OLD.dgi_estado IS NULL OR OLD.dgi_estado != 'aprobado') THEN
    -- Verificar que no esté ya en la cola
    IF NOT EXISTS (
      SELECT 1 FROM invoice_email_queue
      WHERE invoice_id = NEW.id
      AND status IN ('pending', 'processing')
    ) THEN
      -- Agregar a cola de emails con alta prioridad
      INSERT INTO invoice_email_queue (invoice_id, priority, status)
      VALUES (NEW.id, 10, 'pending');
      
      RAISE NOTICE 'Factura % agregada a cola de emails (aprobada por DGI)', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_queue_invoice_email_on_dgi_approval ON invoices;

CREATE TRIGGER trigger_queue_invoice_email_on_dgi_approval
  AFTER INSERT OR UPDATE OF dgi_estado ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION queue_invoice_email_on_dgi_approval();

COMMENT ON TABLE invoice_email_queue IS 'Cola de facturas pendientes de envío por email';
COMMENT ON COLUMN invoice_email_queue.priority IS 'Prioridad (mayor número = mayor prioridad)';
COMMENT ON COLUMN invoice_email_queue.attempts IS 'Número de intentos de envío';
