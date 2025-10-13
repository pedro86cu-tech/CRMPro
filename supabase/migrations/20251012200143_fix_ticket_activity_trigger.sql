/*
  # Fix Ticket Activity Trigger

  1. Changes
    - Fix the ticket activity trigger to use correct user_id field
    - Remove incorrect use of updated_at timestamp as user_id
*/

-- Drop and recreate the trigger function with correct logic
CREATE OR REPLACE FUNCTION log_ticket_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ticket_activity (ticket_id, user_id, action, description)
    VALUES (NEW.id, NEW.created_by, 'created', 'Ticket creado');
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO ticket_activity (ticket_id, user_id, action, field_changed, old_value, new_value)
      VALUES (NEW.id, NEW.created_by, 'status_changed', 'status', OLD.status, NEW.status);
    END IF;
    
    -- Log priority changes
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      INSERT INTO ticket_activity (ticket_id, user_id, action, field_changed, old_value, new_value)
      VALUES (NEW.id, NEW.created_by, 'priority_changed', 'priority', OLD.priority, NEW.priority);
    END IF;
    
    -- Log assignment changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO ticket_activity (ticket_id, user_id, action, field_changed, old_value, new_value)
      VALUES (NEW.id, NEW.created_by, 'assigned', 'assigned_to', 
              COALESCE(OLD.assigned_to::text, 'Sin asignar'), 
              COALESCE(NEW.assigned_to::text, 'Sin asignar'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;