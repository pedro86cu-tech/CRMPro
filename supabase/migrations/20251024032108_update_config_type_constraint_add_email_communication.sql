/*
  # Agregar email_communication al constraint de config_type

  1. Changes
    - Actualiza el constraint de config_type en external_invoice_api_config
    - Agrega 'email_communication' como tipo válido
    - Mantiene los tipos existentes: 'validation' y 'pdf_generation'

  2. Notes
    - Permite guardar configuraciones de tipo email_communication
    - Usado para enviar comunicaciones automáticas de órdenes
*/

-- Eliminar constraint existente
ALTER TABLE external_invoice_api_config 
DROP CONSTRAINT IF EXISTS external_invoice_api_config_config_type_check;

-- Agregar constraint actualizado con email_communication
ALTER TABLE external_invoice_api_config
ADD CONSTRAINT external_invoice_api_config_config_type_check 
CHECK (config_type IN ('validation', 'pdf_generation', 'email_communication'));