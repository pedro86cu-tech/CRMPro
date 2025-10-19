# Guía de Integración con DGI Uruguay

## Resumen del Sistema

Se ha implementado un sistema completo de validación externa de facturas con integración automática a DGI (Dirección General Impositiva) de Uruguay, permitiendo la emisión de Comprobantes Fiscales Electrónicos (CFE).

## Características Implementadas

### 1. Base de Datos

#### Campos Agregados a Facturas (`invoices`)
- `numero_cfe`: Número de Comprobante Fiscal Electrónico
- `serie_cfe`: Serie del CFE
- `tipo_cfe`: Tipo de CFE (eFactura, eTicket, eRemito, etc)
- `cae`: Código de Autorización Electrónico
- `vencimiento_cae`: Fecha de vencimiento del CAE
- `qr_code`: Datos para código QR en el PDF
- `validation_response`: Respuesta completa de la validación (JSONB)
- `validated_at`: Fecha/hora de validación
- `auto_validate`: Si debe validarse automáticamente (default: true)
- `pending_validation`: Marca facturas que esperan validación

#### Tablas de Configuración
- `external_invoice_api_config`: Configuraciones de APIs externas
- `external_invoice_validation_log`: Historial completo de validaciones

### 2. Interfaz Visual de Mapeo de Campos

Se creó un componente visual (`FieldMapper`) que permite mapear campos sin necesidad de escribir JSON manualmente.

**Campos Disponibles para Mapeo (Request):**
- Información de factura: número, total, subtotal, IVA, moneda, fechas
- Información de cliente: nombre, razón social, RUT/NIT, dirección, etc.
- Información de orden: número de orden, envío, método de pago

**Campos Disponibles para Captura (Response):**
- numero_cfe, serie_cfe, tipo_cfe
- cae, vencimiento_cae
- qr_code
- approved, message, reference

### 3. Template Predefinido para DGI Uruguay

Incluye un template pre-configurado con los campos comunes de DGI:

**Request Mapping (Lo que se envía a DGI):**
```json
{
  "numero_cfe": "",
  "serie": "",
  "tipo_cfe": "",
  "rut_emisor": "",
  "razon_social_emisor": "",
  "rut_receptor": "invoice.clients.tax_id",
  "razon_social_receptor": "invoice.clients.company_name",
  "fecha_emision": "invoice.issue_date",
  "moneda": "invoice.currency",
  "total": "invoice.total_amount",
  "subtotal": "invoice.subtotal",
  "iva": "invoice.tax_amount"
}
```

**Response Mapping (Lo que se captura de DGI):**
```json
{
  "approved": "response.aprobado",
  "numero_cfe": "response.numero_cfe",
  "serie_cfe": "response.serie",
  "tipo_cfe": "response.tipo_cfe",
  "cae": "response.cae",
  "vencimiento_cae": "response.vencimiento_cae",
  "qr_code": "response.qr_data",
  "reference": "response.id_transaccion",
  "message": "response.mensaje"
}
```

### 4. Validación Automática

#### Trigger de Base de Datos
Cuando una factura cambia a estado `draft`, se marca automáticamente como `pending_validation = true`.

#### Edge Function Actualizada
`validate-invoice-external` ahora:
1. Lee la configuración activa de API
2. Mapea campos según configuración
3. Envía request a DGI
4. Captura respuesta y extrae campos mapeados
5. **Actualiza automáticamente** los campos de factura:
   - numero_cfe, serie_cfe, tipo_cfe
   - cae, vencimiento_cae, qr_code
   - validation_response (JSON completo)
   - validated_at, status = 'validated'

### 5. PDF Actualizado

El PDF de facturas ahora muestra:
- **Número CFE** en lugar del número interno (cuando existe)
- **Serie y Tipo de CFE**
- **CAE y Fecha de Vencimiento del CAE**
- Todos los demás datos originales (cliente, items, montos)

**Ejemplo del PDF:**
```
┌─────────────────────────────┐
│         FACTURA             │
├─────────────────────────────┤
│ CFE: 101000001              │ <- Número DGI
│ Serie: A                    │
│ Tipo: eFactura              │
│ Fecha: 19/10/2025           │
│ Vencimiento: 19/11/2025     │
│ Moneda: UYU                 │
│ CAE: ABC123XYZ              │
│ Vence CAE: 19/10/2026       │
└─────────────────────────────┘
```

## Configuración Inicial

### Paso 1: Configurar API de DGI

1. Navegue a **"Validación Ext."** en el menú lateral
2. Click en **"Nueva Configuración"**
3. Complete los datos:
   - **Nombre**: "DGI Uruguay - Producción"
   - **URL**: Su endpoint de DGI (ej: `https://api.dgi.gub.uy/v1/validate`)
   - **Autenticación**: Bearer Token
   - **Token**: Su token de DGI

4. Click en **"Cargar Template DGI Uruguay"**
   - Esto pre-carga todos los campos comunes

5. **Personalice los campos fijos** en Request Mapping:
   - `rut_emisor`: Agregue su RUT
   - `razon_social_emisor`: Agregue su razón social
   - `serie`: Defina la serie a usar
   - `tipo_cfe`: Defina el tipo (ej: "eFactura")

6. **Ajuste el Response Mapping** si DGI usa nombres diferentes:
   - Modifique las rutas según la estructura real de respuesta de DGI

7. **Pruebe la configuración**:
   - Ingrese un ID de factura de prueba
   - Click en "Probar"
   - Verifique que la respuesta sea correcta

8. **Active la configuración** y guarde

### Paso 2: Verificar Configuración de Factura

Las facturas nuevas se crean con `auto_validate = true` por defecto.

Para desactivar la validación automática en una factura específica:
```sql
UPDATE invoices
SET auto_validate = false
WHERE id = 'invoice-id';
```

## Flujo de Validación

### Flujo Automático

1. **Usuario crea/edita factura** y la marca como "Borrador" (draft)
2. **Trigger de BD** marca `pending_validation = true`
3. **Sistema detecta** facturas pendientes
4. **Edge Function** ejecuta validación automáticamente:
   - Envía datos a DGI
   - Recibe CFE, CAE, etc.
   - Actualiza factura con datos oficiales
   - Marca `status = 'validated'`
5. **PDF se genera** con datos oficiales de DGI
6. **Usuario envía factura** al cliente con datos válidos

### Flujo Manual

Desde el módulo de facturas:
1. Seleccione una factura
2. Click en "Validar con DGI"
3. El sistema ejecuta la validación
4. Se actualizan los campos automáticamente

## Ejemplo Completo de Integración

### Request que se envía a DGI:
```json
{
  "rut_emisor": "211234560018",
  "razon_social_emisor": "Mi Empresa S.A.",
  "serie": "A",
  "tipo_cfe": "eFactura",
  "rut_receptor": "219876540015",
  "razon_social_receptor": "Cliente XYZ S.R.L.",
  "fecha_emision": "2025-10-19T20:00:00.000Z",
  "moneda": "UYU",
  "total": 2420,
  "subtotal": 2000,
  "iva": 420,
  "items": [
    {
      "descripcion": "Baño completo - Partner X",
      "cantidad": 1,
      "precio_unitario": 2000,
      "iva_porcentaje": 22,
      "total": 2420
    }
  ]
}
```

### Response esperada de DGI:
```json
{
  "aprobado": true,
  "numero_cfe": "101000001",
  "serie": "A",
  "tipo_cfe": "eFactura",
  "cae": "ABC123XYZ789",
  "vencimiento_cae": "2026-10-19",
  "qr_data": "https://dgi.gub.uy/qr/...",
  "id_transaccion": "TX-123456",
  "mensaje": "CFE aprobado correctamente"
}
```

### Datos guardados en la factura:
```sql
UPDATE invoices SET
  numero_cfe = '101000001',
  serie_cfe = 'A',
  tipo_cfe = 'eFactura',
  cae = 'ABC123XYZ789',
  vencimiento_cae = '2026-10-19',
  qr_code = 'https://dgi.gub.uy/qr/...',
  validation_response = '{"aprobado": true, ...}',
  validated_at = NOW(),
  status = 'validated'
WHERE id = 'invoice-id';
```

## Monitoreo y Logs

### Ver Historial de Validaciones

En la pestaña **"Historial de Validaciones"**:
- Estado de cada validación (success, error, timeout)
- Resultado (approved, rejected, pending, error)
- Request y Response completos
- Duración y reintentos
- Mensajes de error detallados

### Buscar Facturas Pendientes

```sql
SELECT * FROM invoices
WHERE pending_validation = true
AND auto_validate = true;
```

### Ver Facturas Validadas

```sql
SELECT
  invoice_number,
  numero_cfe,
  cae,
  validated_at,
  status
FROM invoices
WHERE status = 'validated'
ORDER BY validated_at DESC;
```

## Solución de Problemas

### Factura no se valida automáticamente

1. **Verificar que existe configuración activa:**
```sql
SELECT * FROM external_invoice_api_config
WHERE is_active = true;
```

2. **Verificar que factura tiene auto_validate = true:**
```sql
SELECT auto_validate FROM invoices WHERE id = 'invoice-id';
```

3. **Verificar trigger:**
```sql
SELECT pending_validation FROM invoices WHERE id = 'invoice-id';
```

### Error en validación

Revise el log:
```sql
SELECT * FROM external_invoice_validation_log
WHERE invoice_id = 'invoice-id'
ORDER BY created_at DESC
LIMIT 1;
```

### Response no se interpreta correctamente

1. Vea el Response completo en el log
2. Verifique el Response Mapping en la configuración
3. Ajuste las rutas según la estructura real de DGI

## Seguridad

- ✅ Credenciales almacenadas de forma segura en BD
- ✅ Comunicación con DGI desde servidor (edge function)
- ✅ RLS habilitado en todas las tablas
- ✅ Logs completos para auditoría
- ✅ Validación de datos antes de enviar
- ✅ Reintentos automáticos con backoff

## Próximas Mejoras

- [ ] Integración con código QR visual en PDF
- [ ] Webhook para notificar validaciones exitosas
- [ ] Dashboard de métricas de validación
- [ ] Soporte para múltiples tipos de CFE
- [ ] Validación por lotes (bulk validation)
- [ ] Integración con items de factura detallados

## Contacto y Soporte

Para problemas o dudas:
1. Revise los logs de validación
2. Verifique la documentación de API de DGI
3. Use la función de "Probar" antes de activar
