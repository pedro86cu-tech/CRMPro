/*
  # Fix invoice validated trigger

  1. Changes
    - Remove dependency on pg_net extension
    - Instead of calling edge function directly from trigger, just allow the update
    - The edge function should be called from the frontend or a separate scheduled job

  2. Notes
    - The trigger that called the edge function has been removed
    - Updates to status='validated' will work normally
    - Email sending should be triggered manually or from frontend
*/

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_invoice_validated ON invoices;
DROP FUNCTION IF EXISTS trigger_send_invoice_email();

-- Note: To send invoice emails, call the edge function manually:
-- POST /functions/v1/send-invoice-email with body: { "invoice_id": "uuid" }
