/*
  # Trigger Automático para Validar Facturas con DGI
  
  1. Funcionalidad
    - Cuando una factura se marca como pending_validation = true
    - Llama automáticamente a la edge function validate-invoice-external
    - Usa pg_net para hacer HTTP request a la edge function
    
  2. Requisitos
    - Extensión pg_net habilitada
    - Edge function validate-invoice-external desplegada
    - Configuración activa en external_invoice_api_config
    
  3. Proceso
    - Trigger detecta pending_validation = true
    - Llama a edge function con invoice_id
    - La edge function maneja retry y actualización de estado
*/

-- Habilitar extensión pg_net si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Función para enviar factura a validación automáticamente
CREATE OR REPLACE FUNCTION auto_validate_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_request_id bigint;
  v_function_url text;
BEGIN
  -- Solo procesar si pending_validation cambió a true
  IF NEW.pending_validation = true AND (OLD.pending_validation IS NULL OR OLD.pending_validation = false) THEN
    
    -- Obtener URL de Supabase desde configuración
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    
    -- Si no está configurado, usar valor por defecto basado en el dominio actual
    IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
      -- Intentar construir URL desde variables de entorno o configuración
      v_supabase_url := 'https://rkopighbiwdzpzsjpgeq.supabase.co';
    END IF;
    
    v_function_url := v_supabase_url || '/functions/v1/validate-invoice-external';
    
    RAISE NOTICE 'Enviando factura % a validación automática en URL: %', NEW.id, v_function_url;
    
    -- Hacer request HTTP asíncrono a la edge function usando pg_net
    SELECT INTO v_request_id extensions.http_post(
      url := v_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'sub'
      ),
      body := jsonb_build_object(
        'invoice_id', NEW.id::text
      )
    );
    
    RAISE NOTICE 'Request ID de validación: %', v_request_id;
    
    -- Actualizar pending_validation a false para evitar re-procesamiento
    NEW.pending_validation := false;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger que se ejecuta después de INSERT o UPDATE
DROP TRIGGER IF EXISTS trigger_auto_validate_invoice ON invoices;

CREATE TRIGGER trigger_auto_validate_invoice
  BEFORE INSERT OR UPDATE OF pending_validation ON invoices
  FOR EACH ROW
  WHEN (NEW.pending_validation = true)
  EXECUTE FUNCTION auto_validate_invoice();

COMMENT ON TRIGGER trigger_auto_validate_invoice ON invoices IS 
  'Envía automáticamente facturas a validación DGI cuando pending_validation = true';
