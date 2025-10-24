/*
  # Deshabilitar trigger roto temporalmente
  
  1. Problema
    - El trigger send_invoice_to_external_api_on_approval() está causando que TODOS los UPDATEs fallen
    - Usa nombres de columnas incorrectos (currency, payment_terms, dgi_cae, dgi_qr_data, etc.)
    - Esto impide que las facturas se actualicen después de validación DGI
    
  2. Solución Inmediata
    - Deshabilitar el trigger completamente
    - Esto permitirá que las facturas se actualicen correctamente
    
  3. Siguiente Paso
    - Crear versión corregida del trigger con nombres correctos de columnas
*/

-- Deshabilitar el trigger que está causando problemas
DROP TRIGGER IF EXISTS trigger_send_invoice_to_external_api ON invoices;

-- También eliminar la función para evitar que se vuelva a crear el trigger
DROP FUNCTION IF EXISTS send_invoice_to_external_api_on_approval() CASCADE;

COMMENT ON TABLE invoices IS 'Trigger send_invoice_to_external_api_on_approval DESHABILITADO temporalmente - causaba fallos en todos los UPDATEs por usar columnas inexistentes';
