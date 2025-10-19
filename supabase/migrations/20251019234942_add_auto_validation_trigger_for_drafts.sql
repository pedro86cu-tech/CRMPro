/*
  # Trigger automático de validación para facturas en borrador

  1. Función de trigger
    - Se ejecuta cuando una factura cambia a status 'draft'
    - Verifica si auto_validate = true
    - Llama a la edge function de validación

  2. Nota Importante
    - El trigger no puede llamar directamente a edge functions
    - En su lugar, vamos a actualizar una columna "pending_validation"
    - La aplicación frontend puede escuchar cambios en esta columna
    - O podemos usar un webhook/cron job para procesar facturas pendientes

  3. Alternativa simple
    - Agregar campo "pending_validation" boolean
    - El frontend verifica este campo y llama a la validación
*/

-- Agregar campo para indicar que la factura está pendiente de validación
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS pending_validation boolean DEFAULT false;

-- Función que marca facturas como pendientes de validación
CREATE OR REPLACE FUNCTION mark_invoice_for_validation()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la factura cambió a 'draft' y tiene auto_validate = true
  IF NEW.status = 'draft' AND (NEW.auto_validate IS NULL OR NEW.auto_validate = true) THEN
    -- Si el status cambió de otro estado a 'draft', o es una inserción nueva
    IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
      NEW.pending_validation := true;
      RAISE NOTICE 'Factura % marcada para validación automática', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger que se ejecuta BEFORE INSERT or UPDATE
DROP TRIGGER IF EXISTS trigger_mark_invoice_for_validation ON invoices;

CREATE TRIGGER trigger_mark_invoice_for_validation
  BEFORE INSERT OR UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION mark_invoice_for_validation();

-- Índice para búsquedas de facturas pendientes
CREATE INDEX IF NOT EXISTS idx_invoices_pending_validation 
  ON invoices(pending_validation) 
  WHERE pending_validation = true;

COMMENT ON COLUMN invoices.pending_validation IS 'Indica si la factura está pendiente de validación externa automática';
