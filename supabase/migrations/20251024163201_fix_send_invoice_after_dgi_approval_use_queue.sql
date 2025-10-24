/*
  # Arreglar envío de facturas después de aprobación DGI
  
  1. Problema
    - El trigger trigger_send_invoice_after_dgi_approval no está funcionando
    - Las facturas aprobadas por DGI no se están enviando
    - No hay logs de send-invoice-pdf en la última hora
    
  2. Solución
    - En lugar de usar net.http_post (que puede fallar silenciosamente)
    - Volver a usar invoice_pdf_queue PERO con config_id correcto
    - Esto garantiza que se procese correctamente
    
  3. Flujo
    - DGI aprueba factura (dgi_estado = 'aprobado')
    - Trigger agrega entrada a invoice_pdf_queue con config_type = 'pdf_generation'
    - Hook useInvoicePdfQueue procesa la cola
    - Llama a send-invoice-pdf con el config correcto
*/

-- Recrear trigger que usa invoice_pdf_queue con config correcto
CREATE OR REPLACE FUNCTION trigger_send_invoice_after_dgi_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_pdf_config_id uuid;
  v_existing_queue_id uuid;
BEGIN
  -- Solo procesar si dgi_estado cambió a 'aprobado'
  IF NEW.dgi_estado = 'aprobado' AND (OLD.dgi_estado IS NULL OR OLD.dgi_estado != 'aprobado') THEN
    
    -- Buscar configuración activa de pdf_generation
    SELECT id INTO v_pdf_config_id
    FROM external_invoice_api_config
    WHERE config_type = 'pdf_generation'
      AND is_active = true
    LIMIT 1;
    
    IF v_pdf_config_id IS NULL THEN
      RAISE WARNING '⚠️ No hay configuración de PDF activa para factura %', NEW.invoice_number;
      RETURN NEW;
    END IF;
    
    -- Verificar si ya existe en la cola
    SELECT id INTO v_existing_queue_id
    FROM invoice_pdf_queue
    WHERE invoice_id = NEW.id
      AND status IN ('pending', 'processing');
    
    IF v_existing_queue_id IS NULL THEN
      -- No existe, insertar nuevo con config_id correcto
      INSERT INTO invoice_pdf_queue (
        invoice_id,
        config_id,
        status,
        priority,
        attempts
      ) VALUES (
        NEW.id,
        v_pdf_config_id,  -- IMPORTANTE: Usar config de pdf_generation
        'pending',
        10,
        0
      );
      
      RAISE NOTICE '✅ [PDF] Factura % agregada a cola con config %', NEW.invoice_number, v_pdf_config_id;
    ELSE
      -- Ya existe, actualizar para re-procesar
      UPDATE invoice_pdf_queue
      SET 
        status = 'pending',
        config_id = v_pdf_config_id,  -- Actualizar config_id correcto
        priority = GREATEST(priority, 10),
        attempts = 0,
        last_error = NULL
      WHERE id = v_existing_queue_id;
      
      RAISE NOTICE '🔄 [PDF] Factura % ya en cola, re-procesando con config %', NEW.invoice_number, v_pdf_config_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear trigger
DROP TRIGGER IF EXISTS trigger_send_invoice_after_dgi_approval ON invoices;

CREATE TRIGGER trigger_send_invoice_after_dgi_approval
  AFTER UPDATE ON invoices
  FOR EACH ROW
  WHEN (NEW.dgi_estado = 'aprobado' AND (OLD.dgi_estado IS DISTINCT FROM 'aprobado'))
  EXECUTE FUNCTION trigger_send_invoice_after_dgi_approval();

-- Re-habilitar realtime en invoice_pdf_queue para que el hook funcione
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE invoice_pdf_queue;
  RAISE NOTICE '✅ Realtime RE-HABILITADO en invoice_pdf_queue';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'ℹ️ invoice_pdf_queue ya estaba en supabase_realtime';
  WHEN others THEN
    RAISE WARNING 'Error al habilitar realtime: %', SQLERRM;
END $$;

-- Actualizar comentario de la tabla
COMMENT ON TABLE invoice_pdf_queue IS 
  '✅ SISTEMA ACTIVO - Cola de procesamiento de PDFs de facturas. Procesada por hook useInvoicePdfQueue que llama a send-invoice-pdf.';

COMMENT ON TRIGGER trigger_send_invoice_after_dgi_approval ON invoices IS 
  'Agrega facturas aprobadas por DGI a invoice_pdf_queue con config_id de pdf_generation';

-- Log
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Sistema de PDFs RE-HABILITADO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Trigger actualizado para usar config_id correcto';
  RAISE NOTICE '✅ Realtime habilitado en invoice_pdf_queue';
  RAISE NOTICE '🔄 Flujo: DGI aprueba → trigger → invoice_pdf_queue (con config_id) → hook → send-invoice-pdf';
  RAISE NOTICE '========================================';
END $$;
