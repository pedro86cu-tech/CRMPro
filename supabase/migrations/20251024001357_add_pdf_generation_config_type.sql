/*
  # Agregar tipo de configuración para generación de PDFs

  1. Cambios
    - Agregar 'pdf_generation' como nuevo tipo de configuración en external_invoice_api_config
    - Crear nueva tabla 'invoice_pdf_queue' para cola de generación de PDFs
    - Crear función trigger para agregar facturas a la cola de PDFs cuando DGI aprueba
    
  2. Seguridad
    - Enable RLS en invoice_pdf_queue
    - Políticas para usuarios autenticados
*/

-- Modificar constraint para agregar pdf_generation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'external_invoice_api_config_auth_type_check'
  ) THEN
    ALTER TABLE external_invoice_api_config 
    DROP CONSTRAINT external_invoice_api_config_auth_type_check;
  END IF;
END $$;

ALTER TABLE external_invoice_api_config 
ADD CONSTRAINT external_invoice_api_config_auth_type_check 
CHECK (auth_type IN ('basic', 'bearer', 'api_key', 'none'));

-- Agregar columna para tipo de configuración (validación o generación de PDF)
ALTER TABLE external_invoice_api_config 
ADD COLUMN IF NOT EXISTS config_type text DEFAULT 'validation' CHECK (config_type IN ('validation', 'pdf_generation'));

COMMENT ON COLUMN external_invoice_api_config.config_type IS 'Tipo de configuración: validation (DGI) o pdf_generation (generación de PDFs)';

-- Crear tabla de cola para generación de PDFs
CREATE TABLE IF NOT EXISTS invoice_pdf_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  config_id uuid REFERENCES external_invoice_api_config(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  priority int DEFAULT 1,
  attempts int DEFAULT 0,
  last_error text,
  pdf_id text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  UNIQUE(invoice_id, config_id)
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_invoice_pdf_queue_status ON invoice_pdf_queue(status);
CREATE INDEX IF NOT EXISTS idx_invoice_pdf_queue_invoice_id ON invoice_pdf_queue(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_pdf_queue_created_at ON invoice_pdf_queue(created_at);

-- Habilitar RLS
ALTER TABLE invoice_pdf_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Permitir lectura autenticada para PDF queue"
  ON invoice_pdf_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Permitir inserción autenticada para PDF queue"
  ON invoice_pdf_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Permitir actualización autenticada para PDF queue"
  ON invoice_pdf_queue FOR UPDATE
  TO authenticated
  USING (true);

-- Función para agregar factura a cola de PDFs cuando DGI aprueba
CREATE OR REPLACE FUNCTION queue_invoice_pdf_on_dgi_approval()
RETURNS TRIGGER AS $$
DECLARE
  pdf_config_id uuid;
BEGIN
  -- Si dgi_estado cambió a 'aprobado'
  IF NEW.dgi_estado = 'aprobado' AND (OLD.dgi_estado IS NULL OR OLD.dgi_estado != 'aprobado') THEN
    
    -- Buscar configuración activa de tipo pdf_generation
    SELECT id INTO pdf_config_id
    FROM external_invoice_api_config
    WHERE config_type = 'pdf_generation'
    AND is_active = true
    LIMIT 1;
    
    -- Si hay configuración de PDF activa
    IF pdf_config_id IS NOT NULL THEN
      -- Verificar que no esté ya en la cola
      IF NOT EXISTS (
        SELECT 1 FROM invoice_pdf_queue
        WHERE invoice_id = NEW.id
        AND status IN ('pending', 'processing')
      ) THEN
        -- Agregar a cola de PDFs con alta prioridad
        INSERT INTO invoice_pdf_queue (invoice_id, config_id, priority, status)
        VALUES (NEW.id, pdf_config_id, 10, 'pending')
        ON CONFLICT (invoice_id, config_id) DO NOTHING;
        
        RAISE NOTICE 'Factura % agregada a cola de PDFs (aprobada por DGI)', NEW.id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_queue_invoice_pdf_on_dgi_approval ON invoices;

CREATE TRIGGER trigger_queue_invoice_pdf_on_dgi_approval
  AFTER INSERT OR UPDATE OF dgi_estado ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION queue_invoice_pdf_on_dgi_approval();

COMMENT ON TABLE invoice_pdf_queue IS 'Cola de facturas pendientes de generación y envío de PDF';
COMMENT ON COLUMN invoice_pdf_queue.priority IS 'Prioridad (mayor número = mayor prioridad)';
COMMENT ON COLUMN invoice_pdf_queue.attempts IS 'Número de intentos de generación de PDF';
COMMENT ON COLUMN invoice_pdf_queue.pdf_id IS 'ID del PDF generado por la API externa';
