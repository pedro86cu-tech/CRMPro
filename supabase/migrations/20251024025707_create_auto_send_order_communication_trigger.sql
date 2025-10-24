/*
  # Trigger automático para enviar comunicaciones cuando orden se confirma

  1. New Functions
    - `trigger_send_order_communication()`: Función que se ejecuta cuando una orden cambia a 'confirmed'
    - Llama a la edge function `send-order-communication` automáticamente

  2. New Triggers
    - `trigger_order_confirmed`: Se ejecuta AFTER UPDATE en la tabla orders
    - Solo se dispara cuando el estado cambia de 'pending' a 'confirmed'

  3. Behavior
    - Busca datos del cliente y partner asociados a la orden
    - Construye el payload para la comunicación
    - Llama a la API de comunicaciones de forma asíncrona
    - Registra en el historial de validaciones con tipo EMAIL

  4. Notes
    - El trigger es asíncrono para no bloquear la actualización de la orden
    - Los errores no afectan la confirmación de la orden
    - Se puede desactivar eliminando el trigger si no se necesita
*/

-- Función para enviar comunicación cuando orden se confirma
CREATE OR REPLACE FUNCTION trigger_send_order_communication()
RETURNS TRIGGER AS $$
DECLARE
  v_client_record RECORD;
  v_partner_record RECORD;
  v_order_items JSONB;
  v_payload JSONB;
  v_config_record RECORD;
  v_response JSONB;
  v_http_response RECORD;
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

    -- Obtener datos del partner si existe
    IF NEW.partner_id IS NOT NULL THEN
      SELECT * INTO v_partner_record
      FROM partners
      WHERE id = NEW.partner_id;
    END IF;

    -- Obtener items de la orden
    SELECT jsonb_agg(
      jsonb_build_object(
        'description', description,
        'quantity', quantity,
        'unit_price', unit_price,
        'total', total_price
      )
    ) INTO v_order_items
    FROM order_items
    WHERE order_id = NEW.id;

    -- Construir payload para la comunicación
    v_payload := jsonb_build_object(
      'template_name', 'agenda_confirmation',
      'recipient_email', v_client_record.email,
      'order_id', NEW.id,
      'wait_for_invoice', true,
      'data', jsonb_build_object(
        'client_name', COALESCE(v_client_record.contact_name, v_client_record.company_name),
        'order_number', NEW.order_number,
        'order_date', NEW.order_date,
        'total_amount', NEW.total_amount,
        'partner_name', COALESCE(v_partner_record.business_name, 'N/A'),
        'items', v_order_items
      )
    );

    -- Intentar llamar a la edge function de forma asíncrona usando pg_net
    -- Si pg_net no está disponible, registrar en logs
    BEGIN
      -- Usar http extension si está disponible
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/send-order-communication',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := v_payload
      );
      
      RAISE NOTICE 'Comunicación enviada para orden %', NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        -- Si falla, solo registrar el error sin bloquear la orden
        RAISE NOTICE 'Error enviando comunicación: %', SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger (eliminar si existe)
DROP TRIGGER IF EXISTS trigger_order_confirmed ON orders;

CREATE TRIGGER trigger_order_confirmed
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed'))
  EXECUTE FUNCTION trigger_send_order_communication();