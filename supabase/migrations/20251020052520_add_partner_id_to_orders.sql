/*
  # Agregar Partner ID a Órdenes
  
  1. Cambios
    - Agregar partner_id a tabla orders
    - Crear foreign key a partners
    - Crear índice para búsqueda eficiente
  
  2. Propósito
    - Vincular órdenes directamente con partners
    - Facilitar facturación de comisiones por partner
    - Mantener trazabilidad de comisiones
*/

-- Agregar partner_id a orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN partner_id uuid REFERENCES partners(id);
  END IF;
END $$;

-- Crear índice
CREATE INDEX IF NOT EXISTS idx_orders_partner_id ON orders(partner_id);

-- Actualizar órdenes existentes con partner_id basado en external_partner_id
UPDATE orders o
SET partner_id = p.id
FROM partners p
WHERE o.external_partner_id = p.external_id
AND o.partner_id IS NULL;

COMMENT ON COLUMN orders.partner_id IS 'ID del partner asociado a la orden para facturación de comisiones';
