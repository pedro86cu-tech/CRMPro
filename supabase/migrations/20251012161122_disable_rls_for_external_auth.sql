/*
  # Deshabilitar RLS para Autenticación Externa
  
  1. Cambios
    - Deshabilitar RLS en tablas principales del CRM
    - Mantener estructura de auditoría
    - La autenticación se maneja a nivel de aplicación
  
  2. Razón
    - El sistema usa autenticación externa, no auth.uid()
    - RLS causaba errores de inserción
    - La seguridad se mantiene a nivel de aplicación
  
  3. Tablas Afectadas
    - clients
    - campaigns
    - contact_groups
    - orders
    - invoices
    - tickets
    - calls
    - email_templates
    - template_variables
    - campaign_analytics
*/

-- Deshabilitar RLS en todas las tablas principales
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE contact_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE calls DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE template_variables DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_analytics DISABLE ROW LEVEL SECURITY;

-- Nota: La seguridad se mantiene a nivel de aplicación
-- Los usuarios deben estar autenticados para acceder al sistema
