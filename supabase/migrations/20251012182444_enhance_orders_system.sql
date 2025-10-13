/*
  # Enhance orders system with complete fields

  1. Changes to `orders` table
    - Add missing columns for a complete order system:
      - `order_date`, `due_date` - Date management
      - `subtotal`, `tax_rate`, `tax_amount` - Financial calculations
      - `discount_amount`, `shipping_cost` - Additional costs
      - `currency` - Currency support
      - `customer_notes`, `shipping_address`, `billing_address` - Customer info
      - `payment_terms`, `payment_status` - Payment tracking

  2. New Tables
    - `order_items` - Line items for each order

  3. Functions
    - Auto-generate order numbers
    - Auto-calculate order totals

  4. Security
    - RLS policies already exist, add for order_items
*/

-- Add missing columns to orders table
DO $$
BEGIN
  -- Order dates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_date') THEN
    ALTER TABLE orders ADD COLUMN order_date date NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'due_date') THEN
    ALTER TABLE orders ADD COLUMN due_date date;
  END IF;

  -- Financial fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'subtotal') THEN
    ALTER TABLE orders ADD COLUMN subtotal numeric(12, 2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tax_rate') THEN
    ALTER TABLE orders ADD COLUMN tax_rate numeric(5, 2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tax_amount') THEN
    ALTER TABLE orders ADD COLUMN tax_amount numeric(12, 2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'discount_amount') THEN
    ALTER TABLE orders ADD COLUMN discount_amount numeric(12, 2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_cost') THEN
    ALTER TABLE orders ADD COLUMN shipping_cost numeric(12, 2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'currency') THEN
    ALTER TABLE orders ADD COLUMN currency text NOT NULL DEFAULT 'USD';
  END IF;

  -- Customer information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_notes') THEN
    ALTER TABLE orders ADD COLUMN customer_notes text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_address') THEN
    ALTER TABLE orders ADD COLUMN shipping_address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'billing_address') THEN
    ALTER TABLE orders ADD COLUMN billing_address text;
  END IF;

  -- Payment fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_terms') THEN
    ALTER TABLE orders ADD COLUMN payment_terms text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
    ALTER TABLE orders ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid';
  END IF;
END $$;

-- Add constraints for status and payment_status if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
    CHECK (payment_status IN ('unpaid', 'partial', 'paid'));
  END IF;
END $$;

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'product' CHECK (item_type IN ('product', 'service')),
  description text NOT NULL,
  quantity numeric(12, 2) NOT NULL DEFAULT 1,
  unit_price numeric(12, 2) NOT NULL DEFAULT 0,
  discount_percent numeric(5, 2) NOT NULL DEFAULT 0,
  line_total numeric(12, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Enable RLS on order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_items
DROP POLICY IF EXISTS "Users can view all order items" ON order_items;
DROP POLICY IF EXISTS "Users can create order items" ON order_items;
DROP POLICY IF EXISTS "Users can update all order items" ON order_items;
DROP POLICY IF EXISTS "Users can delete all order items" ON order_items;

CREATE POLICY "Users can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update all order items"
  ON order_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete all order items"
  ON order_items FOR DELETE
  TO authenticated
  USING (true);

-- Function to auto-generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  order_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM orders
  WHERE order_number ~ '^ORD-[0-9]+$';
  
  order_num := 'ORD-' || LPAD(next_num::TEXT, 5, '0');
  RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update order totals when items change
CREATE OR REPLACE FUNCTION update_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  order_subtotal numeric(12, 2);
  order_record RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT * INTO order_record FROM orders WHERE id = OLD.order_id;
  ELSE
    SELECT * INTO order_record FROM orders WHERE id = NEW.order_id;
  END IF;

  SELECT COALESCE(SUM(line_total), 0) INTO order_subtotal
  FROM order_items
  WHERE order_id = order_record.id;

  UPDATE orders
  SET 
    subtotal = order_subtotal,
    tax_amount = (order_subtotal - discount_amount) * (tax_rate / 100),
    total_amount = (order_subtotal - discount_amount) * (1 + tax_rate / 100) + shipping_cost,
    updated_at = now()
  WHERE id = order_record.id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update order totals
DROP TRIGGER IF EXISTS trigger_update_order_totals ON order_items;
CREATE TRIGGER trigger_update_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_order_totals();