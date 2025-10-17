/*
  # Add 'confirmed' to payment_status allowed values

  1. Changes
    - Add 'confirmed' as a valid value for orders.payment_status
    - This allows DogCatify webhooks to use 'confirmed' as payment status
  
  2. Security
    - No security changes, only extending allowed values
*/

-- Drop the existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- Add the new constraint with 'confirmed' included
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('unpaid', 'pending', 'processing', 'partial', 'paid', 'confirmed', 'refunded', 'cancelled'));