/*
  # Arreglar Datos de Comisión y Contabilidad
  
  1. Actualizar Órdenes
    - Extraer commission_amount del metadata
    - Calcular commission_rate
  
  2. Crear Partner por Defecto
    - DogCatify como partner principal
  
  3. Actualizar Facturas
    - Asignar partner_id a facturas existentes
    - Preparar para facturación de comisiones
  
  4. Crear Trigger
    - Registrar automáticamente facturas enviadas para facturar comisiones
*/

-- Paso 1: Crear partner por defecto (DogCatify)
INSERT INTO partners (
  external_id,
  name,
  company_name,
  email,
  phone,
  is_active
)
VALUES (
  'dogcatify-main',
  'DogCatify',
  'DogCatify S.A.',
  'billing@dogcatify.com',
  '+598 99 999 999',
  true
)
ON CONFLICT (external_id) DO NOTHING;

-- Paso 2: Actualizar órdenes con commission_amount del metadata
UPDATE orders
SET 
  commission_amount = COALESCE((metadata->>'commission_amount')::numeric, 0),
  commission_rate = CASE 
    WHEN total_amount > 0 AND (metadata->>'commission_amount')::numeric > 0 
    THEN ROUND(((metadata->>'commission_amount')::numeric / total_amount) * 100, 2)
    ELSE 0 
  END
WHERE metadata IS NOT NULL
  AND metadata->>'commission_amount' IS NOT NULL
  AND commission_amount = 0;

-- Paso 3: Actualizar facturas con partner_id de DogCatify
UPDATE invoices
SET partner_id = (SELECT id FROM partners WHERE external_id = 'dogcatify-main' LIMIT 1)
WHERE order_id IN (
  SELECT id FROM orders WHERE commission_amount > 0
)
AND partner_id IS NULL;

-- Paso 4: Crear trigger para marcar facturas para facturación de comisiones
CREATE OR REPLACE FUNCTION mark_invoice_for_commission_billing()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo procesar si el estado cambió a 'sent'
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
    -- Verificar si tiene comisión asociada
    IF EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = NEW.order_id
      AND o.commission_amount > 0
      AND NEW.is_commission_invoice = false
      AND NEW.commission_billed = false
    ) THEN
      -- Actualizar partner_id si no está set
      IF NEW.partner_id IS NULL THEN
        NEW.partner_id := (SELECT id FROM partners WHERE external_id = 'dogcatify-main' LIMIT 1);
      END IF;
      
      RAISE NOTICE 'Factura % marcada para facturación de comisión', NEW.invoice_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger si no existe
DROP TRIGGER IF EXISTS trigger_mark_invoice_for_commission ON invoices;
CREATE TRIGGER trigger_mark_invoice_for_commission
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION mark_invoice_for_commission_billing();

-- Crear vista para facturas pendientes de facturar comisiones
CREATE OR REPLACE VIEW invoices_pending_commission AS
SELECT 
  i.id as invoice_id,
  i.invoice_number,
  i.total_amount as invoice_total,
  i.issue_date,
  i.status,
  o.commission_amount,
  o.commission_rate,
  p.id as partner_id,
  p.name as partner_name,
  c.contact_name as client_name,
  c.company_name as client_company
FROM invoices i
JOIN orders o ON o.id = i.order_id
LEFT JOIN partners p ON p.id = i.partner_id
LEFT JOIN clients c ON c.id = i.client_id
WHERE i.status = 'sent'
  AND i.is_commission_invoice = false
  AND i.commission_billed = false
  AND o.commission_amount > 0
ORDER BY i.issue_date DESC;

COMMENT ON VIEW invoices_pending_commission IS 
  'Vista de facturas enviadas pendientes de generar factura de comisión';
