/*
  # Disable RLS for orders system with external auth

  1. Changes
    - Disable RLS on orders table
    - Disable RLS on order_items table
    - Drop all existing policies since they're not needed without RLS
  
  2. Security
    - External authentication system handles authorization
    - Application-level security controls access
    - This matches the pattern used for other tables (clients, campaigns, etc.)
*/

-- Disable RLS on orders
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Disable RLS on order_items  
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;

-- Drop policies since RLS is disabled
DROP POLICY IF EXISTS "Allow all operations for authenticated users on orders" ON orders;
DROP POLICY IF EXISTS "Users can delete orders" ON orders;
DROP POLICY IF EXISTS "Users can update orders" ON orders;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on order_items" ON order_items;