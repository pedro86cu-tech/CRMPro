/*
  # Enable Realtime for Invoices Table

  1. Changes
    - Enable realtime for the invoices table to allow real-time updates
    - This allows the client statistics to update automatically when an invoice is marked as paid

  2. Purpose
    - Provides real-time synchronization between invoice status changes and client statistics
    - Improves user experience by updating data without requiring page refresh
*/

-- Enable realtime for invoices table
ALTER publication supabase_realtime ADD TABLE invoices;
