/*
  # Mejorar Tabla de Partners para Integración con DogCatify
  
  1. Cambios en Tabla Partners
    - Renombrar company_name a business_name (para coincidir con DogCatify)
    - Separar address en componentes: calle, numero, barrio, codigo_postal
    - Hacer campos opcionales según lo que envía DogCatify
  
  2. Seguridad
    - Mantener RLS existente
*/

-- Agregar nuevas columnas de dirección detallada
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'calle') THEN
    ALTER TABLE partners ADD COLUMN calle text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'numero') THEN
    ALTER TABLE partners ADD COLUMN numero text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'barrio') THEN
    ALTER TABLE partners ADD COLUMN barrio text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'business_name') THEN
    ALTER TABLE partners ADD COLUMN business_name text;
  END IF;
END $$;

-- Migrar company_name a business_name si existe
UPDATE partners 
SET business_name = company_name 
WHERE business_name IS NULL AND company_name IS NOT NULL;

-- Actualizar partner de DogCatify con nueva estructura
UPDATE partners
SET 
  business_name = COALESCE(business_name, name),
  country = COALESCE(country, 'Uruguay')
WHERE external_id = 'dogcatify-main';

-- Crear índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_partners_business_name ON partners(business_name);

-- Comentarios
COMMENT ON COLUMN partners.calle IS 'Calle de la dirección del partner (DogCatify)';
COMMENT ON COLUMN partners.numero IS 'Número de puerta (DogCatify)';
COMMENT ON COLUMN partners.barrio IS 'Barrio o zona (DogCatify)';
COMMENT ON COLUMN partners.business_name IS 'Nombre comercial o razón social del partner';
