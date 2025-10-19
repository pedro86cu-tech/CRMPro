/*
  # Populate Initial System Parameters

  1. Data Population
    - Insert default currencies (UYU, USD, EUR, ARS, BRL)
    - Insert order statuses (pending, confirmed, in_progress, processing, shipped, delivered, completed, cancelled)
    - Insert payment statuses (unpaid, pending, processing, partial, paid, refunded, cancelled, confirmed)
    - Insert item types (product, service)
    - Insert payment methods (mercadopago, transfer, cash, card, other)
    - Insert invoice statuses (draft, sent, viewed, paid, overdue, cancelled, refunded)
  
  2. Notes
    - Uses INSERT ... ON CONFLICT to avoid duplicates
    - Sets appropriate colors and sort orders
    - Marks UYU as default currency
*/

-- Populate currencies
INSERT INTO currencies (code, name, symbol, is_active, is_default) VALUES
  ('UYU', 'Peso Uruguayo', '$', true, true),
  ('USD', 'Dólar Estadounidense', 'US$', true, false),
  ('EUR', 'Euro', '€', true, false),
  ('ARS', 'Peso Argentino', 'AR$', true, false),
  ('BRL', 'Real Brasileño', 'R$', true, false)
ON CONFLICT (code) DO NOTHING;

-- Populate order_statuses
INSERT INTO order_statuses (code, name, color, sort_order, is_active) VALUES
  ('pending', 'Pendiente', '#f59e0b', 1, true),
  ('confirmed', 'Confirmada', '#3b82f6', 2, true),
  ('in_progress', 'En Progreso', '#8b5cf6', 3, true),
  ('processing', 'Procesando', '#6366f1', 4, true),
  ('shipped', 'Enviada', '#06b6d4', 5, true),
  ('delivered', 'Entregada', '#10b981', 6, true),
  ('completed', 'Completada', '#22c55e', 7, true),
  ('cancelled', 'Cancelada', '#ef4444', 8, true)
ON CONFLICT (code) DO NOTHING;

-- Populate payment_statuses
INSERT INTO payment_statuses (code, name, color, sort_order, is_active) VALUES
  ('unpaid', 'Sin Pagar', '#ef4444', 1, true),
  ('pending', 'Pendiente', '#f59e0b', 2, true),
  ('processing', 'Procesando', '#3b82f6', 3, true),
  ('partial', 'Pago Parcial', '#f97316', 4, true),
  ('paid', 'Pagado', '#22c55e', 5, true),
  ('confirmed', 'Confirmado', '#10b981', 6, true),
  ('refunded', 'Reembolsado', '#8b5cf6', 7, true),
  ('cancelled', 'Cancelado', '#64748b', 8, true)
ON CONFLICT (code) DO NOTHING;

-- Populate item_types
INSERT INTO item_types (code, name, is_active) VALUES
  ('product', 'Producto', true),
  ('service', 'Servicio', true)
ON CONFLICT (code) DO NOTHING;

-- Populate payment_methods
INSERT INTO payment_methods (code, name, is_active) VALUES
  ('mercadopago', 'Mercado Pago', true),
  ('transfer', 'Transferencia Bancaria', true),
  ('cash', 'Efectivo', true),
  ('card', 'Tarjeta de Crédito/Débito', true),
  ('other', 'Otro', true)
ON CONFLICT (code) DO NOTHING;

-- Populate invoice_statuses
INSERT INTO invoice_statuses (code, name, color, sort_order, is_active) VALUES
  ('draft', 'Borrador', '#64748b', 1, true),
  ('sent', 'Enviada', '#3b82f6', 2, true),
  ('viewed', 'Vista', '#8b5cf6', 3, true),
  ('paid', 'Pagada', '#22c55e', 4, true),
  ('overdue', 'Vencida', '#ef4444', 5, true),
  ('cancelled', 'Cancelada', '#6b7280', 6, true),
  ('refunded', 'Reembolsada', '#f59e0b', 7, true)
ON CONFLICT (code) DO NOTHING;