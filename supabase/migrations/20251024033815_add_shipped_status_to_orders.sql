/*
  # Agregar estado 'shipped' a la tabla orders

  1. Changes
    - Actualiza el constraint de status en orders
    - Agrega 'shipped' como estado válido
    - Mantiene todos los estados existentes

  2. Estados disponibles
    - pending: Pedido pendiente
    - confirmed: Pedido confirmado
    - in_progress: En progreso
    - processing: Procesando
    - completed: Completado
    - cancelled: Cancelado
    - sent-error-email: Error enviando email
    - shipped: Enviada (comunicación enviada exitosamente)

  3. Notes
    - Usado cuando la comunicación por email se envía correctamente
    - Indica que el cliente recibió la notificación
*/

-- Eliminar constraint existente
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

-- Agregar constraint actualizado con shipped
ALTER TABLE orders
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'pending',
  'confirmed', 
  'in_progress',
  'processing',
  'completed',
  'cancelled',
  'sent-error-email',
  'shipped'
));