/*
  # Fix: Trigger llama directamente a edge function usando pg_net

  1. Changes
    - Actualiza trigger_send_order_communication() para usar pg_net correctamente
    - Construye el payload completo antes de enviar
    - Llama directamente a send-order-communication edge function
    - Obtiene la URL de Supabase de las variables de entorno

  2. Notes
    - pg_net hace llamadas asíncronas HTTP
    - No bloquea el trigger
    - Los errores se registran pero no afectan la orden
*/

-- Función para enviar comunicación cuando orden se confirma
CREATE OR REPLACE FUNCTION trigger_send_order_communication()
RETURNS TRIGGER AS $$
DECLARE
  v_client_record RECORD;
  v_config_record RECORD;
  v_order_metadata JSONB;
  v_payload JSONB;
  v_request_id BIGINT;
BEGIN
  -- Solo ejecutar si el estado cambió a 'confirmed' desde otro estado
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    
    RAISE NOTICE 'Orden confirmada: %', NEW.id;
    
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

    RAISE NOTICE 'Configuración encontrada: %', v_config_record.name;

    -- Obtener datos del cliente
    SELECT * INTO v_client_record
    FROM clients
    WHERE id = NEW.client_id;

    -- Validar que el cliente tenga email
    IF v_client_record.email IS NULL OR v_client_record.email = '' THEN
      RAISE NOTICE 'Cliente sin email configurado';
      RETURN NEW;
    END IF;

    RAISE NOTICE 'Cliente encontrado: % <%>', v_client_record.contact_name, v_client_record.email;

    -- Obtener metadata de la orden
    v_order_metadata := COALESCE(NEW.metadata, '{}'::jsonb);

    -- Construir payload completo para la edge function
    v_payload := jsonb_build_object(
      'template_name', 'agenda_confirmation',
      'recipient_email', v_client_record.email,
      'order_id', NEW.id::text,
      'wait_for_invoice', true,
      'data', jsonb_build_object(
        'client_name', COALESCE(
          v_order_metadata->'customer'->>'display_name',
          v_order_metadata->>'customer_name',
          v_client_record.contact_name,
          v_client_record.company_name,
          'Cliente'
        ),
        'service_name', COALESCE(
          v_order_metadata->>'service_name',
          v_order_metadata->'items'->0->>'name',
          'Servicio'
        ),
        'provider_name', COALESCE(
          v_order_metadata->'partner'->>'business_name',
          v_order_metadata->>'partner_name',
          'Proveedor'
        ),
        'reservation_date', COALESCE(
          v_order_metadata->>'appointment_date',
          NEW.order_date::text
        ),
        'reservation_time', COALESCE(
          v_order_metadata->>'appointment_time',
          ''
        ),
        'pet_name', COALESCE(
          v_order_metadata->>'pet_name',
          ''
        )
      )
    );

    RAISE NOTICE 'Payload construido: %', v_payload::text;

    -- Llamar a la edge function usando pg_net
    BEGIN
      SELECT net.http_post(
        url := current_setting('app.settings.api_url') || '/functions/v1/send-order-communication',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := v_payload
      ) INTO v_request_id;
      
      RAISE NOTICE 'Llamada HTTP iniciada con request_id: %', v_request_id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Si falla pg_net, insertar en cola como fallback
        RAISE NOTICE 'Error con pg_net (%), insertando en cola', SQLERRM;
        
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
          v_payload,
          'pending'
        );
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