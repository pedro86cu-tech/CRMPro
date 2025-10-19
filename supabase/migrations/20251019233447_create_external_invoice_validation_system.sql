/*
  # Sistema de Validación Externa de Facturas

  1. Nuevas Tablas
    - `external_invoice_api_config`
      - `id` (uuid, primary key)
      - `name` (text) - Nombre descriptivo de la configuración
      - `api_url` (text) - URL del endpoint de validación
      - `auth_type` (text) - Tipo de autenticación: 'basic', 'bearer', 'api_key'
      - `auth_credentials` (jsonb) - Credenciales encriptadas
      - `request_mapping` (jsonb) - Mapeo de campos de solicitud
      - `response_mapping` (jsonb) - Mapeo de campos de respuesta
      - `headers` (jsonb) - Headers adicionales
      - `timeout` (integer) - Timeout en milisegundos
      - `retry_attempts` (integer) - Número de reintentos
      - `is_active` (boolean) - Si está activa o no
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (text)
      - `updated_by` (text)

    - `external_invoice_validation_log`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key)
      - `config_id` (uuid, foreign key)
      - `request_payload` (jsonb) - Datos enviados
      - `response_payload` (jsonb) - Respuesta recibida
      - `status_code` (integer) - Código HTTP
      - `status` (text) - success, error, timeout
      - `error_message` (text) - Mensaje de error si aplica
      - `validation_result` (text) - approved, rejected, pending
      - `external_reference` (text) - ID de referencia externa
      - `duration_ms` (integer) - Duración de la llamada
      - `retry_count` (integer) - Número de reintento
      - `created_at` (timestamptz)
      - `created_by` (text)

  2. Seguridad
    - Enable RLS en todas las tablas
    - Políticas para usuarios autenticados
*/

-- Tabla de configuración de API externa
CREATE TABLE IF NOT EXISTS external_invoice_api_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_url text NOT NULL,
  auth_type text NOT NULL CHECK (auth_type IN ('basic', 'bearer', 'api_key', 'none')),
  auth_credentials jsonb DEFAULT '{}'::jsonb,
  request_mapping jsonb DEFAULT '{}'::jsonb,
  response_mapping jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb,
  timeout integer DEFAULT 30000,
  retry_attempts integer DEFAULT 3,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,
  updated_by text
);

ALTER TABLE external_invoice_api_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users"
  ON external_invoice_api_config
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tabla de log de validaciones
CREATE TABLE IF NOT EXISTS external_invoice_validation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  config_id uuid REFERENCES external_invoice_api_config(id) ON DELETE SET NULL,
  request_payload jsonb DEFAULT '{}'::jsonb,
  response_payload jsonb DEFAULT '{}'::jsonb,
  status_code integer,
  status text NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'pending')),
  error_message text,
  validation_result text CHECK (validation_result IN ('approved', 'rejected', 'pending', 'error')),
  external_reference text,
  duration_ms integer,
  retry_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by text
);

ALTER TABLE external_invoice_validation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on validation log"
  ON external_invoice_validation_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_validation_log_invoice_id 
  ON external_invoice_validation_log(invoice_id);

CREATE INDEX IF NOT EXISTS idx_validation_log_config_id 
  ON external_invoice_validation_log(config_id);

CREATE INDEX IF NOT EXISTS idx_validation_log_created_at 
  ON external_invoice_validation_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_validation_log_status 
  ON external_invoice_validation_log(status);

CREATE INDEX IF NOT EXISTS idx_validation_log_validation_result 
  ON external_invoice_validation_log(validation_result);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_external_api_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_external_api_config_updated_at
  BEFORE UPDATE ON external_invoice_api_config
  FOR EACH ROW
  EXECUTE FUNCTION update_external_api_config_updated_at();

-- Insertar configuración por defecto (ejemplo)
INSERT INTO external_invoice_api_config (
  name,
  api_url,
  auth_type,
  request_mapping,
  response_mapping,
  is_active
) VALUES (
  'Sistema de Validación - Ejemplo',
  'https://api.example.com/validate-invoice',
  'bearer',
  '{
    "invoice_number": "invoice.invoice_number",
    "total_amount": "invoice.total_amount",
    "currency": "invoice.currency",
    "issue_date": "invoice.issue_date",
    "client_name": "invoice.clients.contact_name",
    "client_tax_id": "invoice.clients.tax_id"
  }'::jsonb,
  '{
    "status": "response.status",
    "reference": "response.reference_id",
    "message": "response.message",
    "approved": "response.approved"
  }'::jsonb,
  false
) ON CONFLICT DO NOTHING;
