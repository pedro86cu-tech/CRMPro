/*
  # Habilitar múltiples configuraciones de validación
  
  1. Problema
    - Usuario tiene e-factura (activa) y e-ticket (inactiva)
    - Solo puede tener una activa
    - Quiere usar e-ticket como predeterminada
    
  2. Solución Simple
    - Agregar campo priority a external_invoice_api_config
    - La de mayor priority se usa primero
    - Si falla, intenta con la siguiente
    - O el usuario puede especificar cuál usar en cada factura
*/

-- Agregar prioridad a configuraciones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'external_invoice_api_config' AND column_name = 'priority'
  ) THEN
    ALTER TABLE external_invoice_api_config 
    ADD COLUMN priority integer DEFAULT 10;
    
    RAISE NOTICE '✅ Columna priority agregada';
  END IF;
END $$;

COMMENT ON COLUMN external_invoice_api_config.priority IS 
  'Prioridad de uso (mayor = se intenta primero). Útil cuando hay múltiples configs del mismo tipo activas.';

-- Asignar prioridades a las existentes
UPDATE external_invoice_api_config
SET priority = CASE name
  WHEN 'e-ticket' THEN 20  -- Prioridad alta (se usa primero)
  WHEN 'e-factura' THEN 10  -- Prioridad baja (se usa después)
  ELSE 10
END
WHERE config_type = 'validation';

-- Agregar índice
CREATE INDEX IF NOT EXISTS idx_config_type_priority 
ON external_invoice_api_config(config_type, priority DESC, is_active);

-- Log
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Sistema de prioridades configurado';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📋 Configuraciones actuales:';
  RAISE NOTICE '   - e-ticket: priority 20 (se usa PRIMERO)';
  RAISE NOTICE '   - e-factura: priority 10 (se usa después)';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Ahora puedes:';
  RAISE NOTICE '   1. Activar AMBAS configuraciones';
  RAISE NOTICE '   2. validate-invoice-external usará e-ticket primero';
  RAISE NOTICE '   3. Si falla, puede reintentar con e-factura';
  RAISE NOTICE '========================================';
END $$;
