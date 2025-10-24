/*
  # Corregir manejo de conflictos en cola de PDFs
  
  1. Problema
    - El constraint único es (invoice_id, config_id), no solo invoice_id
    - ON CONFLICT debe especificar ambas columnas
    
  2. Solución
    - Ajustar ON CONFLICT para usar (invoice_id, config_id)
    - O simplemente no usar ON CONFLICT si config_id puede ser NULL
*/

CREATE OR REPLACE FUNCTION trigger_send_invoice_after_dgi_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_config_id uuid;
  v_existing_queue_id uuid;
BEGIN
  -- Solo procesar si dgi_estado cambió a 'aprobado'
  IF NEW.dgi_estado = 'aprobado' AND (OLD.dgi_estado IS NULL OR OLD.dgi_estado != 'aprobado') THEN
    
    -- Obtener la configuración activa de generación de PDF
    SELECT id INTO v_config_id
    FROM pdf_generation_config
    WHERE config_type = 'pdf_generation'
      AND is_active = true
    LIMIT 1;
    
    -- Verificar si ya existe en la cola
    SELECT id INTO v_existing_queue_id
    FROM invoice_pdf_queue
    WHERE invoice_id = NEW.id
      AND (config_id = v_config_id OR (config_id IS NULL AND v_config_id IS NULL))
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
        10, -- Prioridad alta para facturas aprobadas por DGI
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
      
      RAISE NOTICE '🔄 Factura % ya estaba en cola, marcada para re-procesamiento', NEW.invoice_number;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_send_invoice_after_dgi_approval() IS
  '[FIXED v4] Inserta facturas aprobadas por DGI en invoice_pdf_queue con manejo correcto de conflictos';
