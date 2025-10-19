/*
  # Add ISO code to currencies table

  1. Changes
    - Add `iso_code` column to currencies table
      - Used for DGI (Tax Authority) integration
      - ISO 4217 numeric code (e.g., 858 for UYU, 840 for USD)
    - Update existing currencies with their ISO codes
  
  2. Notes
    - ISO 4217 numeric codes are standard for international transactions
    - Required for proper tax authority reporting
*/

-- Add iso_code column to currencies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'currencies' AND column_name = 'iso_code'
  ) THEN
    ALTER TABLE currencies ADD COLUMN iso_code text;
  END IF;
END $$;

-- Update existing currencies with ISO codes
UPDATE currencies SET iso_code = '858' WHERE code = 'UYU';
UPDATE currencies SET iso_code = '840' WHERE code = 'USD';
UPDATE currencies SET iso_code = '978' WHERE code = 'EUR';
UPDATE currencies SET iso_code = '032' WHERE code = 'ARS';
UPDATE currencies SET iso_code = '986' WHERE code = 'BRL';