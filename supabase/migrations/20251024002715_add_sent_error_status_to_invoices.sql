/*
  # Agregar estados de envío a facturas

  1. Cambios
    - Agregar 'sent-error' a los estados posibles de facturas
    - 'sent' ya existe
    - 'sent-error' indica que hubo error al enviar el PDF

  2. Flujo de estados
    - draft → validated (después de DGI aprueba)
    - validated → sent (después de enviar PDF exitosamente)
    - validated → sent-error (si falla el envío del PDF)
*/

-- Drop existing constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add new constraint with 'sent-error' status
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('draft', 'validated', 'sent', 'sent-error', 'paid', 'overdue', 'cancelled', 'refused'));

COMMENT ON COLUMN invoices.status IS 'Estado de la factura: draft (borrador), validated (validada por DGI), sent (enviada exitosamente), sent-error (error al enviar), paid (pagada), overdue (vencida), cancelled (cancelada), refused (rechazada por DGI)';
