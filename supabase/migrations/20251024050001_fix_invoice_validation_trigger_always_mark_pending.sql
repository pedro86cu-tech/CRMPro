/*
  # Fix: Trigger de validación debe marcar SIEMPRE pending_validation=true para nuevas facturas
  
  1. Problema
    - Facturas nuevas con auto_validate=true no se están marcando como pending_validation=true
    - Esto previene que se validen automáticamente
    
  2. Solución
    - El trigger debe verificar:
      a) Si es INSERT y auto_validate es true (o NULL, default true)
      b) Marcar pending_validation = true
    - Simplificar la lógica para ser más directa
    
  3. Lógica
    - Para INSERT: Si auto_validate != false, entonces pending_validation = true
    - Para UPDATE: Solo si cambió explícitamente a draft
*/

CREATE OR REPLACE FUNCTION mark_invoice_for_validation()
RETURNS TRIGGER AS $$
BEGIN
  -- Para nuevas facturas (INSERT)
  IF TG_OP = 'INSERT' THEN
    -- Si auto_validate no está explícitamente en false, marcar para validación
    IF COALESCE(NEW.auto_validate, true) = true AND NEW.status = 'draft' THEN
      NEW.pending_validation := true;
      RAISE NOTICE 'Factura nueva % marcada para validación automática (INSERT)', NEW.id;
    END IF;
  
  -- Para actualización de facturas existentes
  ELSIF TG_OP = 'UPDATE' THEN
    -- Si el status cambió a 'draft' y auto_validate está activo
    IF NEW.status = 'draft' 
       AND OLD.status IS DISTINCT FROM 'draft'
       AND COALESCE(NEW.auto_validate, true) = true THEN
      NEW.pending_validation := true;
      RAISE NOTICE 'Factura % cambió a draft - marcada para validación (UPDATE)', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recrear el trigger
DROP TRIGGER IF EXISTS trigger_mark_invoice_for_validation ON invoices;

CREATE TRIGGER trigger_mark_invoice_for_validation
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION mark_invoice_for_validation();

COMMENT ON FUNCTION mark_invoice_for_validation() IS 
'Marca facturas como pending_validation=true cuando: 1) Se insertan en estado draft con auto_validate=true (default), 2) Cambian a estado draft con auto_validate activo';
