/*
  # Fix payment_status constraint for DogCatify integration

  1. Changes
    - Drop the existing `orders_payment_status_check` constraint
    - Add new constraint with extended payment status values:
      - 'unpaid' - No payment received
      - 'pending' - Payment in progress
      - 'processing' - Payment being processed
      - 'partial' - Partial payment received
      - 'paid' - Full payment received
      - 'refunded' - Payment refunded
      - 'cancelled' - Payment cancelled

  2. Status constraint update
    - Add new order status values:
      - 'delivered' - Order delivered
      - 'shipped' - Order shipped

  3. Security
    - No RLS changes needed
*/

-- Drop existing constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
    ALTER TABLE orders DROP CONSTRAINT orders_payment_status_check;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check') THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;

-- Add new constraint with extended values for payment_status
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending', 'processing', 'partial', 'paid', 'refunded', 'cancelled'));

-- Add new constraint with extended values for status
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'in_progress', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'));
