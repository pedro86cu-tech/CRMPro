/*
  # Actualizar estado de pago al confirmar orden

  1. Cambios
    - Actualizar función para cambiar payment_status a 'paid' cuando status = 'confirmed'
    - Anteriormente solo cambiaba a 'paid' cuando status = 'completed'
    - Ahora también lo hace cuando status = 'confirmed'

  2. Lógica de Negocio
    - Cuando order status = 'confirmed' → payment_status = 'paid'
    - Cuando order status = 'completed' → payment_status = 'paid'
    - Esto asegura que al confirmar una orden, el pago queda marcado automáticamente

  3. Notas
    - La confirmación de una orden implica que el pago ya fue procesado
    - Esto mantiene la consistencia entre el estado de la orden y el pago
    - Funciona automáticamente a nivel de base de datos
*/

-- Actualizar función para manejar cambios de estado de orden
CREATE OR REPLACE FUNCTION handle_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el estado cambia a 'confirmed' o 'completed', marcar como pagado
  IF (NEW.status = 'confirmed' OR NEW.status = 'completed') 
     AND (OLD.status IS NULL OR (OLD.status != 'confirmed' AND OLD.status != 'completed')) THEN
    NEW.payment_status := 'paid';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger ya existe, solo actualizamos la función