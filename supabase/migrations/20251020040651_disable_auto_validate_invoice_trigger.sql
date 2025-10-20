/*
  # Deshabilitar trigger automático de validación
  
  1. Razón
    - El trigger auto_validate_invoice causa conflictos
    - Ya tenemos un sistema de procesamiento con useInvoiceAutoValidation hook
    - El trigger intenta usar pg_net pero causa errores de JWT
    
  2. Cambios
    - Eliminar trigger
    - Eliminar función
    - Mantener solo el sistema de hook + edge function process-pending-invoices
*/

-- Eliminar trigger
DROP TRIGGER IF EXISTS trigger_auto_validate_invoice ON invoices;

-- Eliminar función
DROP FUNCTION IF EXISTS auto_validate_invoice();

-- Comentario
COMMENT ON COLUMN invoices.pending_validation IS 
  'Procesado por hook useInvoiceAutoValidation + edge function process-pending-invoices';
