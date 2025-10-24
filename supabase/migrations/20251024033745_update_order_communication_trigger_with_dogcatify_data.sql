/*
  # Actualizar trigger de comunicación de órdenes con datos de Dogcatify

  1. Changes
    - Actualiza la función trigger_send_order_communication()
    - Construye el JSON con los campos correctos de dogcatify_data
    - Llama directamente a la edge function send-order-communication
    - Maneja errores sin bloquear la confirmación de la orden

  2. Campos del JSON
    - template_name: "agenda_confirmation" (por defecto)
    - recipient_email: del cliente
    - order_id: ID de la orden
    - wait_for_invoice: true
    - data: con client_name, service_name, provider_name, reservation_date, reservation_time, pet_name

  3. Notes
    - Los datos vienen de dogcatify_data en la orden
    - Si no hay configuración activa, no se envía comunicación
    - Los errores se registran pero no bloquean
*/

-- Función para enviar comunicación cuando orden se confirma
CREATE OR REPLACE FUNCTION trigger_send_order_communication()
RETURNS TRIGGER AS $$
DECLARE
  v_client_record RECORD;
  v_config_record RECORD;
  v_dogcatify_data JSONB;
  v_payload JSONB;
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Solo ejecutar si el estado cambió a 'confirmed' desde otro estado
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    -- Buscar configuración activa de email_communication
    SELECT * INTO v_config_record
    FROM external_invoice_api_config
    WHERE config_type = 'email_communication'
      AND is_active = true
    LIMIT 1;

    -- Si no hay configuración, salir silenciosamente
    IF NOT FOUND THEN
      RAISE NOTICE 'No hay configuración activa de email_communication';
      RETURN NEW;
    END IF;

    -- Obtener datos del cliente
    SELECT * INTO v_client_record
    FROM clients
    WHERE id = NEW.client_id;

    -- Validar que el cliente tenga email
    IF v_client_record.email IS NULL OR v_client_record.email = '' THEN
      RAISE NOTICE 'Cliente sin email configurado';
      RETURN NEW;
    END IF;

    -- Obtener dogcatify_data de la orden
    v_dogcatify_data := COALESCE(NEW.dogcatify_data, '{}'::jsonb);

    -- Construir payload para la comunicación con los datos de dogcatify
    v_payload := jsonb_build_object(
      'template_name', 'agenda_confirmation',
      'recipient_email', v_client_record.email,
      'order_id', NEW.id,
      'wait_for_invoice', true,
      'data', jsonb_build_object(
        'client_name', COALESCE(
          v_dogcatify_data->>'client_name',
          v_client_record.contact_name,
          v_client_record.company_name
        ),
        'service_name', COALESCE(v_dogcatify_data->>'service_name', 'Servicio'),
        'provider_name', COALESCE(v_dogcatify_data->>'provider_name', 'Proveedor'),
        'reservation_date', COALESCE(v_dogcatify_data->>'reservation_date', NEW.order_date::text),
        'reservation_time', COALESCE(v_dogcatify_data->>'reservation_time', ''),
        'pet_name', COALESCE(v_dogcatify_data->>'pet_name', '')
      )
    );

    -- Llamar a la edge function de forma asíncrona
    BEGIN
      -- Obtener URL de Supabase desde configuración
      v_supabase_url := current_setting('app.supabase_url', true);
      
      IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
        -- Intentar construir desde el host actual
        v_supabase_url := 'https://' || current_setting('request.headers', true)::json->>'host';
      END IF;

      -- Usar pg_net si está disponible para llamada asíncrona
      IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-order-communication',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
          ),
          body := v_payload
        );
        
        RAISE NOTICE 'Comunicación enviada para orden % (async)', NEW.id;
      ELSE
        -- Si pg_net no está disponible, registrar en la cola
        INSERT INTO order_communications_queue (
          order_id,
          template_name,
          recipient_email,
          payload,
          status
        ) VALUES (
          NEW.id,
          'agenda_confirmation',
          v_client_record.email,
          v_payload->'data',
          'pending'
        );
        
        RAISE NOTICE 'Comunicación agregada a cola para orden %', NEW.id;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Si falla, solo registrar el error sin bloquear la orden
        RAISE NOTICE 'Error enviando comunicación: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear trigger
DROP TRIGGER IF EXISTS trigger_order_confirmed ON orders;

CREATE TRIGGER trigger_order_confirmed
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed'))
  EXECUTE FUNCTION trigger_send_order_communication();