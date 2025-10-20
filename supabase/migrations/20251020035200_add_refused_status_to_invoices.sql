/*
  # Agregar estado 'refused' a facturas
  
  1. Cambios
    - Elimina el constraint existente de status
    - Crea un nuevo constraint que incluye 'refused'
    
  2. Estados permitidos
    - draft: Borrador
    - validated: Validada por DGI
    - sent: Enviada al cliente
    - paid: Pagada
    - overdue: Vencida
    - cancelled: Cancelada
    - refused: Rechazada por DGI (NUEVO)
    
  3. Uso
    - Cuando DGI rechaza una factura, se marca como 'refused'
    - Usuario puede editar y cambiar a 'draft' para reintentar
*/

-- Eliminar constraint existente
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Crear nuevo constraint con 'refused' incluido
ALTER TABLE invoices 
ADD CONSTRAINT invoices_status_check 
CHECK (status IN ('draft', 'validated', 'sent', 'paid', 'overdue', 'cancelled', 'refused'));

-- Comentario sobre el nuevo estado
COMMENT ON CONSTRAINT invoices_status_check ON invoices IS 
  'Estados permitidos: draft, validated, sent, paid, overdue, cancelled, refused (rechazada por DGI)';
