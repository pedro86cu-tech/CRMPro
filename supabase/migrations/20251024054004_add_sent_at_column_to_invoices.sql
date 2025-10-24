/*
  # Agregar columna sent_at a invoices
  
  1. Propósito
    - Registrar cuándo se envió el PDF de la factura por email
    - La edge function send-invoice-pdf necesita esta columna
    
  2. Cambios
    - Agregar columna sent_at (timestamp with time zone)
    - Puede ser NULL si la factura no se ha enviado
*/

-- Agregar columna sent_at si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE invoices ADD COLUMN sent_at timestamptz;
    COMMENT ON COLUMN invoices.sent_at IS 'Fecha y hora en que se envió el PDF por email';
  END IF;
END $$;
