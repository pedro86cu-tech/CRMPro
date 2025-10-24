/*
  # Corregir trigger de validación automática de facturas
  
  1. Problema
    - Facturas en estado 'draft' tienen pending_validation = false
    - El trigger mark_invoice_for_validation no está funcionando
    - Las facturas no se procesan automáticamente ante DGI
    
  2. Solución
    - Recrear el trigger con lógica simplificada
    - Marcar TODAS las facturas draft como pending_validation = true
    - Actualizar facturas existentes en borrador
    
  3. Flujo esperado
    - Factura creada en draft → pending_validation = true
    - Hook detecta → Llama a process-pending-invoices
    - Llama a validate-invoice-external con e-ticket
    - Recibe respuesta de DGI
*/

-- Primero, eliminar el trigger actual
DROP TRIGGER IF EXISTS trigger_mark_invoice_for_validation ON invoices;

-- Recrear la función con lógica simplificada
CREATE OR REPLACE FUNCTION mark_invoice_for_validation()
RETURNS TRIGGER AS $$
BEGIN
  -- Para INSERT: Si la factura es draft, marcar para validación
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'draft' THEN
      NEW.pending_validation := true;
      RAISE NOTICE '✅ [INSERT] Factura % marcada pending_validation=true', NEW.invoice_number;
    END IF;
  
  -- Para UPDATE: Si cambió a draft, marcar para validación
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si cambió a draft desde otro estado
    IF NEW.status = 'draft' AND (OLD.status IS NULL OR OLD.status != 'draft') THEN
      NEW.pending_validation := true;
      RAISE NOTICE '✅ [UPDATE] Factura % cambió a draft, marcada pending_validation=true', NEW.invoice_number;
    END IF;
    
    -- Si ya está en draft y pending_validation se puso en false manualmente, dejarlo
    -- (esto permite desactivar la validación automática si es necesario)
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
CREATE TRIGGER trigger_mark_invoice_for_validation
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION mark_invoice_for_validation();

-- Actualizar todas las facturas existentes en draft para marcarlas como pending_validation
UPDATE invoices
SET pending_validation = true
WHERE status = 'draft'
  AND (pending_validation = false OR pending_validation IS NULL)
  AND (dgi_estado IS NULL OR dgi_estado NOT IN ('aprobado', 'rechazado'));

-- Log de resultados
DO $$
DECLARE
  v_updated_count integer;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM invoices
  WHERE status = 'draft' AND pending_validation = true;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Sistema de validación automática RE-ACTIVADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📋 Facturas en draft marcadas: %', v_updated_count;
  RAISE NOTICE '🔄 Serán procesadas automáticamente por:';
  RAISE NOTICE '   1. Hook useInvoiceAutoValidation';
  RAISE NOTICE '   2. Edge function process-pending-invoices';
  RAISE NOTICE '   3. Edge function validate-invoice-external';
  RAISE NOTICE '   4. API e-ticket (priority 20)';
  RAISE NOTICE '========================================';
END $$;
