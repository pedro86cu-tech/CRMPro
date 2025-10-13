/*
  # Fix orders RLS policies for external auth

  1. Changes
    - Drop existing restrictive RLS policies on orders
    - Create single permissive policy that allows all authenticated operations
    - This matches the pattern used in other tables with external auth

  2. Security
    - Policy allows authenticated users full access
    - External auth system handles user validation
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Users can update all orders" ON orders;
DROP POLICY IF EXISTS "Users can delete all orders" ON orders;

-- Create new permissive policy for authenticated users
CREATE POLICY "Allow all operations for authenticated users on orders"
  ON orders
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);