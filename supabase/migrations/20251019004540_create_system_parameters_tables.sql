/*
  # Create System Parameters Tables

  1. New Tables
    - `currencies`
      - `id` (uuid, primary key)
      - `code` (text, unique) - ISO 4217 currency code (UYU, USD, etc.)
      - `name` (text) - Full currency name
      - `symbol` (text) - Currency symbol ($, €, etc.)
      - `is_active` (boolean) - Whether the currency is active
      - `is_default` (boolean) - Whether this is the default currency
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `order_statuses`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Internal code (pending, confirmed, etc.)
      - `name` (text) - Display name
      - `color` (text) - Hex color for UI display
      - `sort_order` (integer) - Display order
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `payment_statuses`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Internal code (unpaid, paid, etc.)
      - `name` (text) - Display name
      - `color` (text) - Hex color for UI display
      - `sort_order` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `item_types`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Internal code (product, service)
      - `name` (text) - Display name
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `payment_methods`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Internal code (mercadopago, transfer, etc.)
      - `name` (text) - Display name
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `invoice_statuses`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Internal code (draft, sent, paid, etc.)
      - `name` (text) - Display name
      - `color` (text) - Hex color for UI display
      - `sort_order` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all parameter tables
    - Add policies for authenticated users to read all parameters
    - Add policies for authenticated users to manage parameters
*/

-- Create currencies table
CREATE TABLE IF NOT EXISTS currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_statuses table
CREATE TABLE IF NOT EXISTS order_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payment_statuses table
CREATE TABLE IF NOT EXISTS payment_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create item_types table
CREATE TABLE IF NOT EXISTS item_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoice_statuses table
CREATE TABLE IF NOT EXISTS invoice_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_statuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for currencies
CREATE POLICY "Anyone can view active currencies"
  ON currencies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage currencies"
  ON currencies FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for order_statuses
CREATE POLICY "Anyone can view active order statuses"
  ON order_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage order statuses"
  ON order_statuses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for payment_statuses
CREATE POLICY "Anyone can view active payment statuses"
  ON payment_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage payment statuses"
  ON payment_statuses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for item_types
CREATE POLICY "Anyone can view active item types"
  ON item_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage item types"
  ON item_types FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for payment_methods
CREATE POLICY "Anyone can view active payment methods"
  ON payment_methods FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage payment methods"
  ON payment_methods FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for invoice_statuses
CREATE POLICY "Anyone can view active invoice statuses"
  ON invoice_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage invoice statuses"
  ON invoice_statuses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_currencies_code ON currencies(code);
CREATE INDEX IF NOT EXISTS idx_currencies_is_active ON currencies(is_active);
CREATE INDEX IF NOT EXISTS idx_order_statuses_code ON order_statuses(code);
CREATE INDEX IF NOT EXISTS idx_order_statuses_is_active ON order_statuses(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_statuses_code ON payment_statuses(code);
CREATE INDEX IF NOT EXISTS idx_payment_statuses_is_active ON payment_statuses(is_active);
CREATE INDEX IF NOT EXISTS idx_item_types_code ON item_types(code);
CREATE INDEX IF NOT EXISTS idx_item_types_is_active ON item_types(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_methods_code ON payment_methods(code);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_active ON payment_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_invoice_statuses_code ON invoice_statuses(code);
CREATE INDEX IF NOT EXISTS idx_invoice_statuses_is_active ON invoice_statuses(is_active);