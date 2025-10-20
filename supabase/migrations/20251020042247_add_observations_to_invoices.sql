/*
  # Agregar Campo de Observaciones a Facturas
  
  1. Nuevo Campo
    - `observations` (text, nullable)
    - Para guardar errores de validación DGI o envío de email
    
  2. Uso
    - Error en DGI → Guarda error en observations, status = "refused"
    - Error al enviar email → Guarda error en observations, status = "sent-error"
    - Visible en el formulario de editar factura
*/

-- Agregar campo observations
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS observations text;

COMMENT ON COLUMN invoices.observations IS 
  'Observaciones y errores de validación DGI o envío de email';
