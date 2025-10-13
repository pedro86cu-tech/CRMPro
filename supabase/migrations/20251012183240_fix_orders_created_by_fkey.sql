/*
  # Fix orders created_by foreign key

  1. Changes
    - Drop the incorrect foreign key constraint pointing to profiles table
    - Since we're using external auth, make created_by nullable and remove the constraint
    - This allows orders to be created without foreign key issues

  2. Notes
    - The created_by field will still store the user ID for tracking purposes
    - No foreign key constraint needed since we're using external authentication
*/

-- Drop the existing foreign key constraint
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_created_by_fkey;

-- Make created_by nullable (it already might be, but ensuring it)
ALTER TABLE orders 
ALTER COLUMN created_by DROP NOT NULL;