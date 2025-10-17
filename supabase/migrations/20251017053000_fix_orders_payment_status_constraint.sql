/*
  # Fix payment_status constraint for DogCatify integration

  1. Changes
    - Drop the existing `orders_payment_status_check` constraint
    - Add new constraint with extended payment status values:
      - 'unpaid' - No payment received
      - 'pending' - Payment in progress (from DogCatify)
      - 'partial' - Partial payment received
      - 'paid' - Full payment received
      - 'refunded' - Payment refunded

  2. Security
    - No RLS changes needed
*/

-- Drop existing constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
    ALTER TABLE orders DROP CONSTRAINT orders_payment_status_check;
  END IF;
END $$;

-- Add new constraint with extended values
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending', 'partial', 'paid', 'refunded'));
