/*
  # Enable Realtime for Orders Table

  1. Changes
    - Enable realtime for the orders table to allow real-time updates
    - This allows the client statistics to update automatically when a new order is created

  2. Purpose
    - Provides real-time synchronization between order creation and client statistics
    - Improves user experience by updating order count without requiring page refresh
*/

-- Enable realtime for orders table
ALTER publication supabase_realtime ADD TABLE orders;
