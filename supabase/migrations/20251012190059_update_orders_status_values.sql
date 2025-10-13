/*
  # Update orders status constraint

  1. Changes
    - Drop existing status check constraint
    - Add new status check constraint with correct values matching the UI
    - Values: 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'
  
  2. Notes
    - This aligns the database constraint with the UI options
    - 'processing' is replaced with 'confirmed' and 'in_progress' for better clarity
*/

-- Drop the old constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Add the new constraint with correct values
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text]));