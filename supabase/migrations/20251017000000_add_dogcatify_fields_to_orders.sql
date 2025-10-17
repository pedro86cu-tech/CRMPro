/*
  # Add DogCatify Integration Fields to Orders and Clients

  1. Changes to `orders` table
    - `external_order_id` (text) - ID de la orden en DogCatify
    - `external_partner_id` (text) - ID del partner en DogCatify
    - `payment_method` (text) - Método de pago usado
    - `metadata` (jsonb) - Datos adicionales del webhook

  2. Changes to `order_items` table
    - `product_name` (text) - Nombre del producto
    - `external_product_id` (text) - ID del producto en DogCatify
    - `total_price` (numeric) - Precio total de la línea

  3. Changes to `clients` table
    - `external_id` (text) - ID del cliente en sistemas externos
    - `source` (text) - Origen del cliente (manual, dogcatify, etc)

  4. Security
    - No changes to RLS policies needed
*/

-- Add fields to orders table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'external_order_id') THEN
    ALTER TABLE orders ADD COLUMN external_order_id text UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'external_partner_id') THEN
    ALTER TABLE orders ADD COLUMN external_partner_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_method') THEN
    ALTER TABLE orders ADD COLUMN payment_method text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'metadata') THEN
    ALTER TABLE orders ADD COLUMN metadata jsonb;
  END IF;
END $$;

-- Add fields to order_items table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'product_name') THEN
    ALTER TABLE order_items ADD COLUMN product_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'external_product_id') THEN
    ALTER TABLE order_items ADD COLUMN external_product_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'total_price') THEN
    ALTER TABLE order_items ADD COLUMN total_price numeric(12, 2);
  END IF;
END $$;

-- Add fields to clients table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'external_id') THEN
    ALTER TABLE clients ADD COLUMN external_id text UNIQUE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'source') THEN
    ALTER TABLE clients ADD COLUMN source text DEFAULT 'manual';
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id ON orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_clients_external_id ON clients(external_id);
CREATE INDEX IF NOT EXISTS idx_clients_source ON clients(source);
