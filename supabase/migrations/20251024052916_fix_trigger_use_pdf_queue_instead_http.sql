/*
  # Usar cola de PDFs en lugar de llamadas HTTP directas
  
  1. Problema
    - pg_net.http_post no puede resolver el hostname de Supabase desde dentro
    - Las llamadas HTTP fallan con "Couldn't resolve host name"
    
  2. Solución
    - En lugar de llamar a la edge function directamente
    - Insertar un registro en invoice_pdf_queue
    - El hook de React procesará la cola automáticamente
    
  3. Beneficios
    - Más confiable (no depende de networking interno)
    - Asíncrono (no bloquea el UPDATE)
    - Reintentos automáticos si falla
    - Mejor monitoreo y logging
*/

CREATE OR REPLACE FUNCTION trigger_send_invoice_after_dgi_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_config_id uuid;
BEGIN
  -- Solo procesar si dgi_estado cambió a 'aprobado'
  IF NEW.dgi_estado = 'aprobado' AND (OLD.dgi_estado IS NULL OR OLD.dgi_estado != 'aprobado') THEN
    
    -- Obtener la configuración activa de generación de PDF
    SELECT id INTO v_config_id
    FROM pdf_generation_config
    WHERE config_type = 'pdf_generation'
      AND is_active = true
    LIMIT 1;
    
    -- Insertar en la cola de PDFs con prioridad alta
    INSERT INTO invoice_pdf_queue (
      invoice_id,
      config_id,
      status,
      priority,
      attempts
    ) VALUES (
      NEW.id,
      v_config_id,
      'pending',
      10, -- Prioridad alta para facturas aprobadas por DGI
      0
    )
    ON CONFLICT (invoice_id) DO UPDATE
    SET 
      status = 'pending',
      priority = GREATEST(invoice_pdf_queue.priority, 10),
      attempts = 0,
      last_error = NULL;
    
    RAISE NOTICE '✅ Factura % agregada a cola de PDFs', NEW.invoice_number;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_send_invoice_after_dgi_approval() IS
  '[FIXED v3] Inserta facturas aprobadas por DGI en invoice_pdf_queue para procesamiento asíncrono';
