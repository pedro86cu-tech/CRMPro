/*
  # Agregar campos de validación DGI a facturas

  1. Cambios en la tabla `invoices`
    - `numero_cfe` (text) - Número de Comprobante Fiscal Electrónico
    - `serie_cfe` (text) - Serie del CFE
    - `tipo_cfe` (text) - Tipo de CFE (eFactura, eTicket, etc)
    - `cae` (text) - Código de Autorización Electrónico
    - `vencimiento_cae` (date) - Fecha de vencimiento del CAE
    - `qr_code` (text) - Datos para código QR
    - `validation_response` (jsonb) - Respuesta completa de validación
    - `validated_at` (timestamptz) - Fecha de validación
    - `auto_validate` (boolean) - Si se debe validar automáticamente
    
  2. Función para trigger automático
    - Trigger que se dispara cuando invoice.status = 'draft'
    - Llama a la función de validación externa
*/

-- Agregar campos de validación DGI a la tabla invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS numero_cfe text,
ADD COLUMN IF NOT EXISTS serie_cfe text,
ADD COLUMN IF NOT EXISTS tipo_cfe text,
ADD COLUMN IF NOT EXISTS cae text,
ADD COLUMN IF NOT EXISTS vencimiento_cae date,
ADD COLUMN IF NOT EXISTS qr_code text,
ADD COLUMN IF NOT EXISTS validation_response jsonb,
ADD COLUMN IF NOT EXISTS validated_at timestamptz,
ADD COLUMN IF NOT EXISTS auto_validate boolean DEFAULT true;

-- Índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_invoices_numero_cfe ON invoices(numero_cfe);
CREATE INDEX IF NOT EXISTS idx_invoices_cae ON invoices(cae);
CREATE INDEX IF NOT EXISTS idx_invoices_validated_at ON invoices(validated_at);

-- Comentarios para documentación
COMMENT ON COLUMN invoices.numero_cfe IS 'Número de Comprobante Fiscal Electrónico asignado por DGI';
COMMENT ON COLUMN invoices.serie_cfe IS 'Serie del CFE';
COMMENT ON COLUMN invoices.tipo_cfe IS 'Tipo de CFE (eFactura, eTicket, eRemito, etc)';
COMMENT ON COLUMN invoices.cae IS 'Código de Autorización Electrónico';
COMMENT ON COLUMN invoices.vencimiento_cae IS 'Fecha de vencimiento del CAE';
COMMENT ON COLUMN invoices.qr_code IS 'Datos para generar código QR en el PDF';
COMMENT ON COLUMN invoices.validation_response IS 'Respuesta completa de la validación externa';
COMMENT ON COLUMN invoices.validated_at IS 'Fecha y hora de validación exitosa';
COMMENT ON COLUMN invoices.auto_validate IS 'Si la factura debe validarse automáticamente al cambiar a draft';
