/*
  # Actualizar facturas aprobadas con datos DGI faltantes
  
  1. Problema
    - Facturas fueron validadas exitosamente con e-ticket
    - Pero los campos DGI (numero_cfe, cae, qr_code, etc.) no se guardaron
    - Esto fue porque el response_mapping estaba mal configurado
    
  2. Solución
    - Ahora que el response_mapping está corregido
    - Actualizar facturas existentes con datos del response_payload guardado en logs
    
  3. Proceso
    - Obtener facturas con validation_result = 'approved' pero sin datos DGI
    - Extraer datos del response_payload del log
    - Actualizar la factura con esos datos (con conversiones de tipo correctas)
*/

-- Actualizar facturas aprobadas con datos DGI desde los logs
WITH approved_logs AS (
  SELECT DISTINCT ON (l.invoice_id)
    l.invoice_id,
    l.response_payload,
    i.invoice_number
  FROM external_invoice_validation_log l
  JOIN invoices i ON i.id = l.invoice_id
  WHERE l.validation_result = 'approved'
    AND l.status = 'success'
    AND (i.dgi_estado IS NULL OR i.numero_cfe IS NULL)
  ORDER BY l.invoice_id, l.created_at DESC
)
UPDATE invoices i
SET 
  numero_cfe = (al.response_payload->>'numero_cfe'),
  serie_cfe = (al.response_payload->>'serie_cfe'),
  tipo_cfe = (al.response_payload->>'tipo_cfe'),
  cae = (al.response_payload->>'cae'),
  vencimiento_cae = CASE 
    WHEN (al.response_payload->>'vencimiento_cae') IS NOT NULL AND (al.response_payload->>'vencimiento_cae') != ''
    THEN (al.response_payload->>'vencimiento_cae')::timestamptz::date
    ELSE NULL
  END,
  qr_code = (al.response_payload->>'qr_code'),
  dgi_estado = (al.response_payload->>'dgi_estado'),
  dgi_codigo_autorizacion = (al.response_payload->>'dgi_codigo_autorizacion'),
  dgi_mensaje = (al.response_payload->>'dgi_mensaje'),
  dgi_id_efactura = (al.response_payload->>'dgi_id_efactura'),
  dgi_fecha_validacion = CASE 
    WHEN (al.response_payload->>'dgi_fecha_validacion') IS NOT NULL
    THEN (al.response_payload->>'dgi_fecha_validacion')::timestamptz
    ELSE NULL
  END
FROM approved_logs al
WHERE i.id = al.invoice_id;

-- Log de resultados
DO $$
DECLARE
  v_updated_count integer;
  v_with_cfe integer;
  v_with_qr integer;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM invoices
  WHERE status = 'validated' AND dgi_estado = 'aprobado';
  
  SELECT COUNT(*) INTO v_with_cfe
  FROM invoices
  WHERE numero_cfe IS NOT NULL;
  
  SELECT COUNT(*) INTO v_with_qr
  FROM invoices
  WHERE qr_code IS NOT NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Facturas actualizadas con datos DGI';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 Facturas validadas y aprobadas: %', v_updated_count;
  RAISE NOTICE '📋 Facturas con número CFE: %', v_with_cfe;
  RAISE NOTICE '🔗 Facturas con código QR: %', v_with_qr;
  RAISE NOTICE '========================================';
END $$;
