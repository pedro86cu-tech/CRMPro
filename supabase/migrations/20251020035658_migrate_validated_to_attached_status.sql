/*
  # Migrar estado 'validated' a 'attached'
  
  1. Cambios
    - Elimina el constraint existente primero
    - Actualiza todas las facturas con status 'validated' a 'attached'
    - Crea nuevo constraint con 'attached' en lugar de 'validated'
    
  2. Estados permitidos (nuevos)
    - draft: Borrador inicial
    - attached: Validada por DGI, lista para enviar
    - sent: Enviada al cliente
    - paid: Pagada
    - overdue: Vencida
    - cancelled: Cancelada
    - refused: Rechazada por DGI
    
  3. Flujo
    - draft → DGI valida → attached → email → sent
*/

-- Paso 1: Eliminar constraint existente PRIMERO
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Paso 2: Actualizar facturas existentes de 'validated' a 'attached'
UPDATE invoices 
SET status = 'attached'
WHERE status = 'validated';

-- Paso 3: Crear nuevo constraint con 'attached' (sin 'validated')
ALTER TABLE invoices 
ADD CONSTRAINT invoices_status_check 
CHECK (status IN ('draft', 'attached', 'sent', 'paid', 'overdue', 'cancelled', 'refused'));

-- Comentario descriptivo
COMMENT ON CONSTRAINT invoices_status_check ON invoices IS 
  'Flujo de estados: draft → attached (validada DGI) → sent (enviada por email) | refused (rechazada por DGI)';
