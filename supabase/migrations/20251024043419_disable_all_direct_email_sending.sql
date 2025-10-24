/*
  # Deshabilitar todo el sistema de envío directo de emails
  
  1. Cambios
    - Eliminar todas las funciones edge que envían emails directamente
    - Desactivar tablas de cola de emails (invoice_email_queue)
    - Solo mantener el sistema de APIs externas (DogCatify)
    
  2. Razón
    - Todo el envío de emails debe ser manejado por APIs externas
    - No debe haber envío directo de emails desde las edge functions
    - Sistema unificado usando solo external_invoice_api_config
    
  3. Sistema que SE MANTIENE
    - send-order-communication (llama a API externa de pending-communication)
    - validate-invoice-external (llama a API externa de DGI)
    - Tabla: external_invoice_validation_log (historial de todas las llamadas)
    
  4. Sistema que SE ELIMINA
    - send-invoice-email (envía emails directamente)
    - send-invoice-pdf (genera y envía PDFs directamente)
    - process-invoice-email-queue (procesa cola de emails)
    - Tabla: invoice_email_queue (ya no se usa)
    - Tabla: invoice_pdf_queue (ya no se usa)
*/

-- Marcar las tablas de cola como deshabilitadas
COMMENT ON TABLE invoice_email_queue IS '⛔ DESHABILITADA - Todo el envío de emails se hace a través de APIs externas (DogCatify)';
COMMENT ON TABLE invoice_pdf_queue IS '⛔ DESHABILITADA - La generación de PDFs se delega a APIs externas (DogCatify)';

-- Eliminar cualquier dato pendiente en las colas (para limpiar)
TRUNCATE TABLE invoice_email_queue;
TRUNCATE TABLE invoice_pdf_queue;

-- Desactivar configuraciones de PDF y Email directo
UPDATE external_invoice_api_config 
SET is_active = false 
WHERE config_type IN ('pdf_generation');

-- Agregar comentario explicativo
COMMENT ON TABLE external_invoice_api_config IS 
'Configuración de APIs externas. 
TIPOS ACTIVOS:
- validation: Validación con DGI
- email_communication: Comunicación por email (órdenes)

TIPOS DESHABILITADOS:
- pdf_generation: Ya no se usa, PDFs se generan en sistema externo';
