/*
  # Simplificar trigger - no depender de pdf_generation_config
  
  1. Cambio
    - Eliminar dependencia de pdf_generation_config.config_type
    - Simplemente usar la primera configuración activa o NULL
    
  2. Beneficio
    - El trigger funciona incluso sin configuración
    - La edge function puede manejar config_id NULL
*/

CREATE OR REPLACE FUNCTION trigger_send_invoice_after_dgi_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_config_id uuid;
  v_existing_queue_id uuid;
BEGIN
  -- Solo procesar si dgi_estado cambió a 'aprobado'
  IF NEW.dgi_estado = 'aprobado' AND (OLD.dgi_estado IS NULL OR OLD.dgi_estado != 'aprobado') THEN
    
    -- Intentar obtener la primera configuración activa (puede ser NULL)
    SELECT id INTO v_config_id
    FROM pdf_generation_config
    WHERE is_active = true
    LIMIT 1;
    
    -- Verificar si ya existe en la cola
    SELECT id INTO v_existing_queue_id
    FROM invoice_pdf_queue
    WHERE invoice_id = NEW.id
      AND status IN ('pending', 'processing');
    
    IF v_existing_queue_id IS NULL THEN
      -- No existe, insertar nuevo
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
        10,
        0
      );
      
      RAISE NOTICE '✅ Factura % agregada a cola de PDFs', NEW.invoice_number;
    ELSE
      -- Ya existe, actualizar para re-procesar
      UPDATE invoice_pdf_queue
      SET 
        status = 'pending',
        priority = GREATEST(priority, 10),
        attempts = 0,
        last_error = NULL
      WHERE id = v_existing_queue_id;
      
      RAISE NOTICE '🔄 Factura % ya estaba en cola, re-procesando', NEW.invoice_number;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_send_invoice_after_dgi_approval() IS
  '[FIXED v5] Inserta facturas aprobadas por DGI en invoice_pdf_queue sin depender de config_type';
