/*
  # Crear trigger para enviar factura después de validación DGI
  
  1. Propósito
    - Cuando una factura es aprobada por DGI (dgi_estado = 'aprobado')
    - Llamar automáticamente a la edge function send-invoice-pdf
    - Esta función genera el PDF y lo envía por email al cliente
    
  2. Funcionamiento
    - Se ejecuta AFTER UPDATE en la tabla invoices
    - Solo cuando dgi_estado cambia a 'aprobado'
    - Llama a la edge function usando HTTP request
    
  3. Nota
    - Usa solo campos que EXISTEN en la tabla invoices
    - No intenta acceder a campos inexistentes
*/

-- Crear función que llama a send-invoice-pdf
CREATE OR REPLACE FUNCTION trigger_send_invoice_after_dgi_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url text;
  v_supabase_key text;
  v_function_url text;
  v_payload jsonb;
BEGIN
  -- Solo procesar si dgi_estado cambió a 'aprobado'
  IF NEW.dgi_estado = 'aprobado' AND (OLD.dgi_estado IS NULL OR OLD.dgi_estado != 'aprobado') THEN
    
    -- Obtener variables de entorno
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_supabase_key := current_setting('app.settings.supabase_service_role_key', true);
    
    -- Si no están configuradas en settings, usar valores por defecto
    IF v_supabase_url IS NULL THEN
      v_supabase_url := 'https://bolt-native-database-58426451.supabase.co';
    END IF;
    
    -- Construir URL de la edge function
    v_function_url := v_supabase_url || '/functions/v1/send-invoice-pdf';
    
    -- Preparar payload
    v_payload := jsonb_build_object(
      'invoice_id', NEW.id,
      'order_id', NEW.order_id
    );
    
    -- Intentar llamar a la edge function
    BEGIN
      PERFORM net.http_post(
        url := v_function_url,
        body := v_payload,
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        )
      );
      
      RAISE NOTICE 'Factura % enviada a send-invoice-pdf', NEW.invoice_number;
      
    EXCEPTION WHEN OTHERS THEN
      -- Si falla, solo loggeamos pero no detenemos el proceso
      RAISE WARNING 'Error al llamar send-invoice-pdf para factura %: %', NEW.invoice_number, SQLERRM;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_send_invoice_after_dgi_approval ON invoices;

CREATE TRIGGER trigger_send_invoice_after_dgi_approval
  AFTER UPDATE ON invoices
  FOR EACH ROW
  WHEN (NEW.dgi_estado = 'aprobado' AND (OLD.dgi_estado IS DISTINCT FROM 'aprobado'))
  EXECUTE FUNCTION trigger_send_invoice_after_dgi_approval();

COMMENT ON TRIGGER trigger_send_invoice_after_dgi_approval ON invoices IS 
  'Llama automáticamente a send-invoice-pdf cuando una factura es aprobada por DGI';

COMMENT ON FUNCTION trigger_send_invoice_after_dgi_approval() IS
  'Función que llama a la edge function send-invoice-pdf cuando dgi_estado cambia a aprobado';
