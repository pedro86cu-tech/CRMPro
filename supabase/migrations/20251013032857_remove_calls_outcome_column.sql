/*
  # Remove outcome column from calls table

  1. Changes
    - Drop the `outcome` column from `calls` table
    - The system now uses only the `status` column for tracking call state
    - Status values: completed, in_progress, missed, cancelled, no_answer

  2. Reason
    - Standardize call tracking using a single field (status) instead of two separate fields (status + outcome)
    - Simplifies the data model and UI consistency between CallModal and CallsModule
*/

DO $$
BEGIN
  -- Remove outcome column if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'outcome'
  ) THEN
    ALTER TABLE calls DROP COLUMN outcome;
  END IF;
END $$;
