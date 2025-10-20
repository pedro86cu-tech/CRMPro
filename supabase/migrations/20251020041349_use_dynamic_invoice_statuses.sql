/*
  # Usar Estados Dinámicos de Factura desde invoice_statuses
  
  1. Cambios
    - Eliminar constraint hardcodeado de estados
    - Crear función de validación contra invoice_statuses
    - Crear trigger para validar estados dinámicamente
    
  2. Beneficios
    - Estados configurables desde Parámetros
    - No necesita migraciones para agregar/quitar estados
    - Valida solo contra estados activos
    
  3. Funcionamiento
    - Al insertar/actualizar factura, valida que el estado exista y esté activo
    - Si el estado no existe o está inactivo, genera error
*/

-- Paso 1: Eliminar constraint hardcodeado
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Paso 2: Crear función de validación dinámica
CREATE OR REPLACE FUNCTION validate_invoice_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar que el estado existe y está activo
  IF NOT EXISTS (
    SELECT 1 FROM invoice_statuses 
    WHERE code = NEW.status 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Estado de factura inválido o inactivo: %', NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Paso 3: Crear trigger de validación
DROP TRIGGER IF EXISTS trigger_validate_invoice_status ON invoices;

CREATE TRIGGER trigger_validate_invoice_status
  BEFORE INSERT OR UPDATE OF status ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION validate_invoice_status();

COMMENT ON TRIGGER trigger_validate_invoice_status ON invoices IS 
  'Valida que el estado de la factura exista en invoice_statuses y esté activo';
