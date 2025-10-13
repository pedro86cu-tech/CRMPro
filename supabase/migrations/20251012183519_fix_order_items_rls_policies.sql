/*
  # Fix order_items RLS policies for external auth

  1. Changes
    - Drop existing restrictive RLS policies on order_items
    - Create permissive policies that allow all authenticated operations
    - This matches the pattern used in other tables with external auth

  2. Security
    - Policies allow authenticated users full access
    - External auth system handles user validation
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all order items" ON order_items;
DROP POLICY IF EXISTS "Users can create order items" ON order_items;
DROP POLICY IF EXISTS "Users can update all order items" ON order_items;
DROP POLICY IF EXISTS "Users can delete all order items" ON order_items;

-- Create new permissive policies for authenticated users
CREATE POLICY "Allow all operations for authenticated users on order_items"
  ON order_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);