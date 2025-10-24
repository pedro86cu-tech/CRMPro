/*
  # Habilitar Realtime para invoice_pdf_queue
  
  1. Cambios
    - Habilitar realtime en invoice_pdf_queue para que el hook detecte nuevos PDFs
    
  2. Beneficios
    - Procesamiento inmediato cuando se agrega una factura a la cola
    - No depender solo del intervalo de 30 segundos
*/

-- Habilitar realtime para la tabla invoice_pdf_queue
ALTER PUBLICATION supabase_realtime ADD TABLE invoice_pdf_queue;

COMMENT ON TABLE invoice_pdf_queue IS 'Cola de facturas pendientes de generación y envío de PDF (con realtime habilitado)';
