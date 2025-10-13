/*
  # Enhance invoices structure for professional invoicing

  1. Changes to invoices table
    - Add order_id to link invoices with orders
    - Add issue_date for invoice emission date
    - Rename amount to total_amount for clarity
    - Add subtotal, tax_amount, discount_amount for detailed calculations
    - Add notes and terms fields
    - Update status enum to include 'cancelled'
  
  2. New table: invoice_items
    - Stores individual line items for each invoice
    - Supports quantity, unit price, tax rate, discount per item
    - Calculates subtotal per item
  
  3. Security
    - RLS is already disabled for external auth compatibility
*/

-- Add new columns to invoices if they don't exist
DO $$
BEGIN
  -- Add order_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN order_id uuid REFERENCES orders(id) ON DELETE SET NULL;
  END IF;

  -- Add issue_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'issue_date'
  ) THEN
    ALTER TABLE invoices ADD COLUMN issue_date date NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  -- Add subtotal column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE invoices ADD COLUMN subtotal decimal(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Add tax_amount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'tax_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN tax_amount decimal(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Add discount_amount column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN discount_amount decimal(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Rename amount to total_amount if amount exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE invoices RENAME COLUMN amount TO total_amount;
  END IF;

  -- Add total_amount if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE invoices ADD COLUMN total_amount decimal(10,2) NOT NULL DEFAULT 0;
  END IF;

  -- Add notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'notes'
  ) THEN
    ALTER TABLE invoices ADD COLUMN notes text;
  END IF;

  -- Add terms column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'terms'
  ) THEN
    ALTER TABLE invoices ADD COLUMN terms text;
  END IF;
END $$;

-- Update status column type if needed
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'invoices' AND column_name = 'status'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
  END IF;

  -- Add new constraint with 'cancelled' status
  ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
    CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity decimal(10,2) NOT NULL DEFAULT 1,
  unit_price decimal(10,2) NOT NULL DEFAULT 0,
  tax_rate decimal(5,2) NOT NULL DEFAULT 0,
  discount decimal(5,2) NOT NULL DEFAULT 0,
  subtotal decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create index on invoice_items.invoice_id for better performance
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Disable RLS for invoice_items (consistent with external auth)
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;