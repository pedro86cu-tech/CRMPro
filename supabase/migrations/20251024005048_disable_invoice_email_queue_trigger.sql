/*
  # Deshabilitar trigger de invoice_email_queue
  
  1. Cambios
    - Deshabilitar trigger que agrega facturas a invoice_email_queue cuando DGI aprueba
    - Solo debe usarse invoice_pdf_queue que llama a la API externa generate-pdf
    
  2. Razón
    - La API externa generate-pdf ya genera el PDF Y envía el email
    - No necesitamos el flujo interno de invoice_email_queue
    - Evita duplicación de envíos de email
*/

-- Deshabilitar el trigger de invoice_email_queue
DROP TRIGGER IF EXISTS trigger_queue_invoice_email_on_dgi_approval ON invoices;

COMMENT ON TABLE invoice_email_queue IS 'Cola de facturas pendientes de envío por email (DESHABILITADA - usar invoice_pdf_queue + API externa)';
