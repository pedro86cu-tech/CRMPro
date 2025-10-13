/*
  # Fix Calls Status Constraint
  
  1. Changes
    - Drop existing status constraint on calls table
    - Add new constraint with all valid statuses including 'in_progress', 'ringing', 'answered'
    - Allow proper call lifecycle tracking
  
  2. Valid Status Values
    - 'ringing': Call is being initiated/ringing
    - 'in_progress': Call is active/ongoing
    - 'answered': Call was answered
    - 'completed': Call ended normally
    - 'missed': Call was not answered
    - 'cancelled': Call was cancelled before completion
    - 'failed': Call failed to connect
    - 'busy': Called party was busy
    - 'no_answer': Call rang but wasn't answered
  
  3. Notes
    - This allows proper tracking of call states from initiation to completion
    - Frontend can now properly track calls in progress
*/

-- Drop existing constraint
ALTER TABLE calls 
  DROP CONSTRAINT IF EXISTS calls_status_check;

-- Add new constraint with all valid statuses
ALTER TABLE calls 
  ADD CONSTRAINT calls_status_check 
  CHECK (status IN (
    'ringing',
    'in_progress', 
    'answered',
    'completed', 
    'missed', 
    'cancelled',
    'failed',
    'busy',
    'no_answer'
  ));
