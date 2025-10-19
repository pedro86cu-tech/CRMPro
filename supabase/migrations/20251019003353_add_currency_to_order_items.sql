/*
  # Add currency field to order_items table

  1. Changes
    - Add `currency` column to `order_items` table
      - Type: text (3 character currency code)
      - Default: 'UYU' (Peso Uruguayo - código DGI de Uruguay)
      - Not null with default value
    
  2. Purpose
    - Track the currency for each order item
    - Support multi-currency products and services
    - Use DGI-compliant currency codes for Uruguay
    
  3. Common DGI Currency Codes for Uruguay:
    - UYU: Peso Uruguayo
    - USD: Dólar Estadounidense
    - EUR: Euro
    - ARS: Peso Argentino
    - BRL: Real Brasileño
*/

-- Add currency column to order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'currency'
  ) THEN
    ALTER TABLE order_items ADD COLUMN currency text NOT NULL DEFAULT 'UYU';
    
    -- Add a comment to the column for documentation
    COMMENT ON COLUMN order_items.currency IS 'Currency code (ISO 4217) - DGI compliant for Uruguay';
  END IF;
END $$;

-- Create an index for currency queries
CREATE INDEX IF NOT EXISTS idx_order_items_currency ON order_items(currency);