/*
  # Create trigger for sending invoices when validated

  1. New Function
    - `trigger_send_invoice_email`: Trigger function that calls the edge function when invoice status changes to 'validated'
    - Makes HTTP POST request to send-invoice-email edge function
    - Runs asynchronously to avoid blocking the update

  2. New Trigger
    - `on_invoice_validated`: Fires after UPDATE on invoices table
    - Only triggers when status changes to 'validated'
    - Automatically sends invoice email to customer

  3. Purpose
    - Automates invoice sending when status is validated
    - Reduces manual work and ensures timely delivery
*/

-- Create function to trigger invoice email sending
CREATE OR REPLACE FUNCTION trigger_send_invoice_email()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  function_url text;
BEGIN
  -- Only proceed if status changed to 'validated'
  IF NEW.status = 'validated' AND (OLD.status IS NULL OR OLD.status != 'validated') THEN
    -- Get Supabase URL from environment
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- If not set, use default (will be set by Supabase)
    IF supabase_url IS NULL THEN
      supabase_url := 'http://kong:8000';
    END IF;
    
    -- Build function URL
    function_url := supabase_url || '/functions/v1/send-invoice-email';
    
    -- Call the edge function asynchronously using pg_net extension
    -- Note: This requires pg_net extension to be enabled
    PERFORM
      net.http_post(
        url := function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
          'invoice_id', NEW.id
        )
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_invoice_validated ON invoices;
CREATE TRIGGER on_invoice_validated
  AFTER UPDATE ON invoices
  FOR EACH ROW
  WHEN (NEW.status = 'validated' AND (OLD.status IS DISTINCT FROM 'validated'))
  EXECUTE FUNCTION trigger_send_invoice_email();

-- Note: The trigger uses pg_net for async HTTP calls
-- If pg_net is not available, the function can be called manually or via a scheduled job
