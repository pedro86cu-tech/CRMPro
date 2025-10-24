/*
  # Agregar tipo de configuración para comunicaciones email

  1. Changes
    - Agrega el tipo 'email_communication' al enum de config_type
    - Permite configurar APIs de envío de comunicaciones por email
    - Se usa para notificaciones de reservas, confirmaciones, etc.

  2. Notes
    - Este tipo se diferencia de 'pdf_generation' y 'validation'
    - Se registra en el historial con tipo EMAIL para diferenciarlo
*/

-- Agregar nuevo tipo al enum de config_type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'config_type_enum' 
    AND e.enumlabel = 'email_communication'
  ) THEN
    ALTER TYPE config_type_enum ADD VALUE IF NOT EXISTS 'email_communication';
  END IF;
EXCEPTION
  WHEN others THEN
    -- Si el tipo no es enum, ignorar
    NULL;
END $$;

-- Si la columna config_type no es enum, actualizarla
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'external_invoice_api_config'
    AND column_name = 'config_type'
    AND data_type = 'USER-DEFINED'
  ) THEN
    -- La columna es text, podemos insertar directamente
    NULL;
  END IF;
END $$;