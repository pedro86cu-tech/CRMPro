/*
  # Actualizar Trigger de Email para Usar Estado Configurado
  
  1. Cambios
    - Reemplazar lógica basada en dgi_estado
    - Usar el estado con sort_order = 2 de invoice_statuses
    - Detectar cuando la factura llega a ese estado configurado
    
  2. Funcionamiento
    - Cuando status cambia al código del estado con sort_order = 2
    - Agrega la factura a la cola de emails
    - Flexible: si cambian el estado en Parámetros, sigue funcionando
    
  3. Ejemplo
    - Si sort_order=2 es "validated" → envía email cuando status='validated'
    - Si cambian a otro código → automáticamente usa el nuevo
*/

-- Actualizar función para usar estado configurado
CREATE OR REPLACE FUNCTION queue_invoice_email_on_dgi_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_validated_status_code text;
BEGIN
  -- Obtener el código del estado configurado con sort_order = 2
  SELECT code INTO v_validated_status_code
  FROM invoice_statuses
  WHERE sort_order = 2 
  AND is_active = true
  LIMIT 1;
  
  -- Si no hay estado configurado con sort_order = 2, no hacer nada
  IF v_validated_status_code IS NULL THEN
    RAISE NOTICE 'No hay estado configurado con sort_order = 2, no se enviará email';
    RETURN NEW;
  END IF;
  
  -- Si el status cambió al estado configurado (sort_order = 2)
  IF NEW.status = v_validated_status_code 
     AND (OLD.status IS NULL OR OLD.status != v_validated_status_code) THEN
    
    -- Verificar que no esté ya en la cola
    IF NOT EXISTS (
      SELECT 1 FROM invoice_email_queue
      WHERE invoice_id = NEW.id
      AND status IN ('pending', 'processing')
    ) THEN
      -- Agregar a cola de emails con alta prioridad
      INSERT INTO invoice_email_queue (invoice_id, priority, status)
      VALUES (NEW.id, 10, 'pending');
      
      RAISE NOTICE 'Factura % agregada a cola de emails (estado: %)', NEW.id, v_validated_status_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear trigger para que escuche cambios en el campo status
DROP TRIGGER IF EXISTS trigger_queue_invoice_email_on_dgi_approval ON invoices;

CREATE TRIGGER trigger_queue_invoice_email_on_dgi_approval
  AFTER INSERT OR UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION queue_invoice_email_on_dgi_approval();

COMMENT ON TRIGGER trigger_queue_invoice_email_on_dgi_approval ON invoices IS 
  'Envía email cuando la factura llega al estado configurado con sort_order = 2 en invoice_statuses';
