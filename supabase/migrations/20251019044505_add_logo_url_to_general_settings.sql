/*
  # Add Logo URL to General Settings

  1. Changes
    - Update general_settings in system_settings to include company_logo_url field
    - This allows companies to add their logo to invoices and other documents
*/

-- The logo URL will be stored in the general_settings JSON object
-- No schema changes needed, just documentation that the field exists
-- Example structure:
-- {
--   "company_name": "Mi Empresa",
--   "company_logo_url": "https://example.com/logo.png",
--   ...
-- }
