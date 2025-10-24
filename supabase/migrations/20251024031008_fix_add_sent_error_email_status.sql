/*
  # Agregar estado sent-error-email manteniendo estados existentes

  1. Changes
    - Actualiza el constraint de status para incluir todos los estados existentes
    - Agrega 'sent-error-email' para errores de envío de comunicaciones
    - Mantiene 'in_progress' que ya existe en la base de datos

  2. Status Values
    - pending: Orden pendiente
    - confirmed: Orden confirmada
    - in_progress: Orden en progreso
    - processing: Orden en procesamiento
    - completed: Orden completada
    - cancelled: Orden cancelada
    - sent-error-email: Error enviando comunicación por email
*/

-- Eliminar constraint existente
DO $$ 
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Agregar constraint actualizado con todos los estados
ALTER TABLE orders
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'pending',
  'confirmed', 
  'in_progress',
  'processing', 
  'completed', 
  'cancelled',
  'sent-error-email'
));