/*
  # Agregar campos adicionales de respuesta DGI

  1. Nuevos campos en tabla `invoices`
    - `dgi_estado` (text) - Estado de validación DGI (aprobado, rechazado, etc)
    - `dgi_codigo_autorizacion` (text) - Código de autorización DGI completo
    - `dgi_mensaje` (text) - Mensaje de respuesta de DGI
    - `dgi_id_efactura` (text) - ID de eFactura asignado por DGI
    - `dgi_fecha_validacion` (timestamptz) - Fecha de validación según DGI

  2. Índices
    - Para búsquedas por estado DGI
    - Para búsquedas por código de autorización
*/

-- Agregar campos de respuesta DGI a la tabla invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS dgi_estado text,
ADD COLUMN IF NOT EXISTS dgi_codigo_autorizacion text,
ADD COLUMN IF NOT EXISTS dgi_mensaje text,
ADD COLUMN IF NOT EXISTS dgi_id_efactura text,
ADD COLUMN IF NOT EXISTS dgi_fecha_validacion timestamptz;

-- Índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_invoices_dgi_estado ON invoices(dgi_estado);
CREATE INDEX IF NOT EXISTS idx_invoices_dgi_codigo_autorizacion ON invoices(dgi_codigo_autorizacion);
CREATE INDEX IF NOT EXISTS idx_invoices_dgi_id_efactura ON invoices(dgi_id_efactura);

-- Comentarios para documentación
COMMENT ON COLUMN invoices.dgi_estado IS 'Estado de validación devuelto por DGI (aprobado, rechazado, pendiente)';
COMMENT ON COLUMN invoices.dgi_codigo_autorizacion IS 'Código de autorización completo asignado por DGI';
COMMENT ON COLUMN invoices.dgi_mensaje IS 'Mensaje descriptivo de la respuesta de DGI';
COMMENT ON COLUMN invoices.dgi_id_efactura IS 'ID único de eFactura asignado por DGI';
COMMENT ON COLUMN invoices.dgi_fecha_validacion IS 'Fecha y hora de validación según DGI';
