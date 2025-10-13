/*
  # Add automatic payment status update trigger

  1. Changes
    - Create function to automatically update payment_status when order status changes
    - Create trigger that fires when order status is updated to 'completed'
    - Automatically sets payment_status to 'paid' when order is completed
  
  2. Business Logic
    - When order status = 'completed' → payment_status = 'paid'
    - This ensures consistency across the system
    - Prevents manual errors in payment tracking
  
  3. Notes
    - This is a database-level automation
    - Works regardless of where the update comes from (UI, API, etc.)
    - Can be extended with more business rules as needed
*/

-- Create function to handle order status changes
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If order status is set to completed, automatically mark as paid
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.payment_status := 'paid';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_order_status_payment ON orders;

-- Create trigger that fires before update
CREATE TRIGGER trigger_order_status_payment
  BEFORE UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION handle_order_status_change();