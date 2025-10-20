/*
  # Create Partners Table and Commission Billing System

  1. New Tables
    - `partners`
      - `id` (uuid, primary key)
      - `external_id` (text, unique) - ID del partner en DogCatify
      - `name` (text) - Nombre del partner/aliado
      - `company_name` (text) - Razón social
      - `rut` (text) - RUT fiscal
      - `email` (text) - Email de contacto
      - `phone` (text) - Teléfono
      - `address` (text) - Dirección fiscal
      - `city` (text) - Ciudad
      - `postal_code` (text) - Código postal
      - `country` (text) - País
      - `is_active` (boolean) - Si está activo
      - `metadata` (jsonb) - Datos adicionales
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to `orders` table
    - `commission_amount` (numeric) - Monto de comisión
    - `commission_rate` (numeric) - Tasa de comisión (%)

  3. Changes to `invoices` table
    - `commission_billed` (boolean) - Si la comisión ya fue facturada
    - `commission_invoice_id` (uuid) - ID de la factura de comisión generada
    - `is_commission_invoice` (boolean) - Si esta factura es de comisión
    - `commission_iva_rate` (numeric) - Tasa IVA para comisiones

  4. Security
    - Enable RLS on `partners` table
    - Add policies for authenticated users
*/

-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  name text NOT NULL,
  company_name text,
  rut text,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  country text DEFAULT 'Uruguay',
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_partners_external_id ON partners(external_id);
CREATE INDEX IF NOT EXISTS idx_partners_rut ON partners(rut);
CREATE INDEX IF NOT EXISTS idx_partners_is_active ON partners(is_active);

-- Enable RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partners
CREATE POLICY "Allow all access to partners"
  ON partners
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add commission fields to orders table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'commission_amount') THEN
    ALTER TABLE orders ADD COLUMN commission_amount numeric(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'commission_rate') THEN
    ALTER TABLE orders ADD COLUMN commission_rate numeric(5, 2) DEFAULT 0;
  END IF;
END $$;

-- Add commission billing fields to invoices table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'commission_billed') THEN
    ALTER TABLE invoices ADD COLUMN commission_billed boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'commission_invoice_id') THEN
    ALTER TABLE invoices ADD COLUMN commission_invoice_id uuid REFERENCES invoices(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'is_commission_invoice') THEN
    ALTER TABLE invoices ADD COLUMN is_commission_invoice boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'commission_iva_rate') THEN
    ALTER TABLE invoices ADD COLUMN commission_iva_rate numeric(5, 2) DEFAULT 22;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'partner_id') THEN
    ALTER TABLE invoices ADD COLUMN partner_id uuid REFERENCES partners(id);
  END IF;
END $$;

-- Create indexes for commission billing
CREATE INDEX IF NOT EXISTS idx_invoices_commission_billed ON invoices(commission_billed);
CREATE INDEX IF NOT EXISTS idx_invoices_is_commission_invoice ON invoices(is_commission_invoice);
CREATE INDEX IF NOT EXISTS idx_invoices_partner_id ON invoices(partner_id);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_partners_updated_at();
