/*
  # Create payment transactions table

  1. New Tables
    - `payment_transactions`
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key to orders)
      - `amount` (numeric, payment amount)
      - `payment_method` (text, e.g., 'credit_card', 'bank_transfer', 'cash')
      - `payment_date` (timestamptz, when payment was received)
      - `reference_number` (text, transaction reference)
      - `notes` (text, optional notes)
      - `created_by` (uuid, nullable for external auth)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS (disabled for external auth compatibility)
    - Track all payment history
  
  3. Business Logic
    - This table tracks individual payment transactions
    - An order can have multiple payments (partial payments)
    - Automatically logs when orders are marked as completed
*/

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'other',
  payment_date timestamptz NOT NULL DEFAULT now(),
  reference_number text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Disable RLS for external auth compatibility
ALTER TABLE payment_transactions DISABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_date ON payment_transactions(payment_date DESC);

-- Create function to automatically log payment when order is completed
CREATE OR REPLACE FUNCTION auto_log_payment_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- If order just became completed and payment status is paid
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.payment_status = 'paid' THEN
    -- Check if payment transaction already exists for this order
    IF NOT EXISTS (
      SELECT 1 FROM payment_transactions WHERE order_id = NEW.id
    ) THEN
      -- Create automatic payment transaction record
      INSERT INTO payment_transactions (
        order_id,
        amount,
        payment_method,
        payment_date,
        reference_number,
        notes,
        created_by
      ) VALUES (
        NEW.id,
        NEW.total_amount,
        'automatic',
        now(),
        'AUTO-' || NEW.order_number,
        'Pago automático al completar orden',
        NEW.created_by
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_log_payment ON orders;

-- Create trigger that fires after update
CREATE TRIGGER trigger_auto_log_payment
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  EXECUTE FUNCTION auto_log_payment_on_completion();