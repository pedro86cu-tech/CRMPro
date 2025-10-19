/*
  # Populate System Parameters with Initial Data

  1. Purpose
    - Insert initial data for all system parameter tables
    - Includes order statuses, payment statuses, invoice statuses
    - Includes item types and payment methods
    - Ensures consistent nomenclature across the system

  2. Tables Populated
    - order_statuses: 8 order lifecycle states
    - payment_statuses: 8 payment processing states
    - invoice_statuses: 7 invoice states
    - item_types: 2 basic types (Product, Service)
    - payment_methods: 5 common payment methods

  3. Notes
    - All parameters start as active (is_active = true)
    - Sort order determines display sequence in UI
    - Colors use hex codes for consistent branding
    - Using INSERT with ON CONFLICT DO NOTHING to allow re-running safely
*/

-- Order Statuses
INSERT INTO order_statuses (code, name, color, sort_order, is_active) VALUES
  ('pending', 'Pendiente', '#eab308', 1, true),
  ('confirmed', 'Confirmada', '#3b82f6', 2, true),
  ('in_progress', 'En Progreso', '#6366f1', 3, true),
  ('processing', 'Procesando', '#8b5cf6', 4, true),
  ('shipped', 'Enviada', '#06b6d4', 5, true),
  ('delivered', 'Entregada', '#14b8a6', 6, true),
  ('completed', 'Completada', '#10b981', 7, true),
  ('cancelled', 'Cancelada', '#ef4444', 8, true)
ON CONFLICT (code) DO NOTHING;

-- Payment Statuses
INSERT INTO payment_statuses (code, name, color, sort_order, is_active) VALUES
  ('unpaid', 'Sin Pagar', '#ef4444', 1, true),
  ('pending', 'Pendiente', '#eab308', 2, true),
  ('processing', 'Procesando', '#3b82f6', 3, true),
  ('partial', 'Parcial', '#f97316', 4, true),
  ('paid', 'Pagado', '#10b981', 5, true),
  ('confirmed', 'Confirmado', '#059669', 6, true),
  ('refunded', 'Reembolsado', '#64748b', 7, true),
  ('cancelled', 'Cancelado', '#ef4444', 8, true)
ON CONFLICT (code) DO NOTHING;

-- Invoice Statuses
INSERT INTO invoice_statuses (code, name, color, sort_order, is_active) VALUES
  ('draft', 'Borrador', '#94a3b8', 1, true),
  ('sent', 'Enviada', '#3b82f6', 2, true),
  ('viewed', 'Vista', '#06b6d4', 3, true),
  ('paid', 'Pagada', '#10b981', 4, true),
  ('partial', 'Parcial', '#f97316', 5, true),
  ('overdue', 'Vencida', '#ef4444', 6, true),
  ('cancelled', 'Cancelada', '#64748b', 7, true)
ON CONFLICT (code) DO NOTHING;

-- Item Types
INSERT INTO item_types (code, name, is_active) VALUES
  ('product', 'Producto', true),
  ('service', 'Servicio', true)
ON CONFLICT (code) DO NOTHING;

-- Payment Methods
INSERT INTO payment_methods (code, name, is_active) VALUES
  ('cash', 'Efectivo', true),
  ('transfer', 'Transferencia Bancaria', true),
  ('credit_card', 'Tarjeta de Crédito', true),
  ('debit_card', 'Tarjeta de Débito', true),
  ('mercadopago', 'Mercado Pago', true),
  ('paypal', 'PayPal', true),
  ('check', 'Cheque', true),
  ('other', 'Otro', true)
ON CONFLICT (code) DO NOTHING;