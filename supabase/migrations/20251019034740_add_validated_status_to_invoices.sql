/*
  # Add 'validated' status to invoices

  1. Changes
    - Update invoices status constraint to include 'validated' status
    - The 'validated' status indicates an invoice is ready to be sent to the customer

  2. Status flow
    - draft → validated → sent → paid/overdue/cancelled
*/

-- Drop existing constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Add new constraint with 'validated' status
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('draft', 'validated', 'sent', 'paid', 'overdue', 'cancelled'));
