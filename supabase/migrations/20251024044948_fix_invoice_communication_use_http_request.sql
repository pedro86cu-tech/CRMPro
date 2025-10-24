/*
  # Actualizar trigger para usar pg_net y enviar HTTP request
  
  1. Cambios
    - Modificar función send_invoice_to_external_api_on_approval()
    - Usar net.http_post() para llamar a la edge function
    - La edge function es 'pending-communication' de DogCatify
    - Registrar resultado en external_invoice_validation_log
    
  2. Flujo HTTP
    - Preparar payload con factura, cliente e items
    - Hacer POST a pending-communication
    - La API externa genera PDF y envía email
    - Actualizar estado de factura según respuesta
*/

-- Función actualizada para enviar factura usando HTTP
CREATE OR REPLACE FUNCTION send_invoice_to_external_api_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_config_id uuid;
  v_api_url text;
  v_auth_type text;
  v_auth_credentials jsonb;
  v_request_payload jsonb;
  v_start_time timestamptz;
  v_duration_ms int;
  v_client_data jsonb;
  v_items_data jsonb;
  v_auth_header text;
  v_request_id bigint;
BEGIN
  -- Solo procesar si dgi_estado cambió a 'aprobado'
  IF NEW.dgi_estado = 'aprobado' AND (OLD.dgi_estado IS NULL OR OLD.dgi_estado != 'aprobado') THEN
    
    v_start_time := clock_timestamp();
    
    -- Buscar configuración activa de tipo email_communication
    SELECT id, api_url, auth_type, auth_credentials
    INTO v_config_id, v_api_url, v_auth_type, v_auth_credentials
    FROM external_invoice_api_config
    WHERE config_type = 'email_communication'
    AND is_active = true
    LIMIT 1;
    
    -- Si no hay configuración activa, salir
    IF v_config_id IS NULL THEN
      RAISE NOTICE 'No hay configuración activa de email_communication para factura %', NEW.id;
      RETURN NEW;
    END IF;
    
    -- Obtener datos del cliente
    SELECT jsonb_build_object(
      'id', c.id,
      'name', COALESCE(c.company_name, c.contact_name),
      'email', c.email,
      'phone', c.phone,
      'address', c.address,
      'city', c.city,
      'country', c.country,
      'tax_id', c.tax_id
    )
    INTO v_client_data
    FROM clients c
    WHERE c.id = NEW.client_id;
    
    -- Obtener items de la factura
    SELECT jsonb_agg(
      jsonb_build_object(
        'description', ii.description,
        'quantity', ii.quantity,
        'unit_price', ii.unit_price,
        'discount', ii.discount_percent,
        'total', ii.line_total,
        'item_type', ii.item_type
      )
    )
    INTO v_items_data
    FROM invoice_items ii
    WHERE ii.invoice_id = NEW.id;
    
    -- Preparar el payload completo
    v_request_payload := jsonb_build_object(
      'invoice', jsonb_build_object(
        'id', NEW.id,
        'invoice_number', NEW.invoice_number,
        'issue_date', NEW.issue_date,
        'due_date', NEW.due_date,
        'subtotal', NEW.subtotal,
        'tax_amount', NEW.tax_amount,
        'discount_amount', NEW.discount_amount,
        'total_amount', NEW.total_amount,
        'currency', NEW.currency,
        'notes', NEW.notes,
        'payment_terms', NEW.payment_terms,
        'dgi_cae', NEW.dgi_cae,
        'dgi_qr_data', NEW.dgi_qr_data,
        'dgi_numero_cfe', NEW.dgi_numero_cfe,
        'dgi_estado', NEW.dgi_estado
      ),
      'client', v_client_data,
      'items', COALESCE(v_items_data, '[]'::jsonb)
    );
    
    -- Preparar header de autenticación si es necesario
    IF v_auth_type = 'bearer' AND v_auth_credentials->>'token' IS NOT NULL THEN
      v_auth_header := 'Bearer ' || (v_auth_credentials->>'token');
    ELSIF v_auth_type = 'api_key' AND v_auth_credentials->>'key' IS NOT NULL THEN
      v_auth_header := v_auth_credentials->>'value';
    END IF;
    
    -- Hacer el HTTP POST usando pg_net
    BEGIN
      SELECT net.http_post(
        url := v_api_url,
        body := v_request_payload,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', COALESCE(v_auth_header, '')
        )
      ) INTO v_request_id;
      
      v_duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000;
      
      -- Registrar el intento en el log
      INSERT INTO external_invoice_validation_log (
        invoice_id,
        config_id,
        request_payload,
        response_payload,
        status_code,
        status,
        validation_result,
        external_reference,
        duration_ms,
        retry_count,
        created_by
      ) VALUES (
        NEW.id,
        v_config_id,
        v_request_payload,
        jsonb_build_object(
          'message', 'Request enviado via pg_net',
          'request_id', v_request_id,
          'api_url', v_api_url
        ),
        200,
        'success',
        'sent',
        NEW.invoice_number,
        v_duration_ms,
        0,
        'system_trigger'
      );
      
      RAISE NOTICE 'Factura % enviada a API externa (request_id: %)', NEW.id, v_request_id;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error al enviar factura %: %', NEW.id, SQLERRM;
      
      v_duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000;
      
      -- Registrar error
      INSERT INTO external_invoice_validation_log (
        invoice_id,
        config_id,
        request_payload,
        status_code,
        status,
        error_message,
        duration_ms,
        retry_count,
        created_by
      ) VALUES (
        NEW.id,
        v_config_id,
        v_request_payload,
        500,
        'failed',
        SQLERRM,
        v_duration_ms,
        0,
        'system_trigger'
      );
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger
DROP TRIGGER IF EXISTS trigger_send_invoice_to_external_api_on_approval ON invoices;

CREATE TRIGGER trigger_send_invoice_to_external_api_on_approval
  AFTER UPDATE OF dgi_estado ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION send_invoice_to_external_api_on_approval();

COMMENT ON FUNCTION send_invoice_to_external_api_on_approval() IS
'Función que usa pg_net.http_post() para enviar facturas aprobadas por DGI a la API externa de comunicación (pending-communication). Envía todos los datos de factura, cliente e items en formato JSON.';
