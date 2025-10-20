# Guía de Pruebas: Validación Externa DGI

## Problema Resuelto

### Error Anterior
```
Error al probar validación: Edge Function returned a non-2xx status code
404 (Not Found)
```

**Causa:** El usuario ingresaba el número CFE (ej: "101000001") en lugar del UUID de la factura.

### Solución Implementada

Se ha reemplazado el campo de texto por un **selector dropdown** que muestra:
- Número de factura interno
- Nombre del cliente
- Número CFE (si existe)

Esto elimina la confusión y asegura que siempre se use el ID correcto.

## Cómo Probar la Validación DGI

### Paso 1: Ir a Configuración de Validación Externa

1. Navegar a **Settings** → **Validación Ext.**
2. Verificar que existe una configuración activa
3. Si no existe, crear una nueva con el template DGI Uruguay

### Paso 2: Configurar API de Prueba (Opcional)

Si deseas probar sin llamar a la API real de DGI:

**URL de Prueba:** `https://httpbin.org/post`

Esta URL acepta cualquier POST y devuelve el JSON que enviaste, útil para verificar el mapeo.

**Configuración de Prueba:**
```json
{
  "name": "DGI Test",
  "api_url": "https://httpbin.org/post",
  "auth_type": "none",
  "request_mapping": {
    "factura_id": "invoice.invoice_number",
    "cliente": "invoice.clients.company_name",
    "total": "invoice.total_amount"
  },
  "response_mapping": {
    "approved": "json.success",
    "numero_cfe": "json.numero_cfe"
  }
}
```

### Paso 3: Seleccionar Factura para Probar

En la sección **"Probar Configuración"**:

1. **Abrir el dropdown** "Seleccionar factura..."
2. **Ver lista** con formato:
   ```
   INV-00001 - Cliente ABC S.A.
   INV-00002 - Juan Pérez (CFE: 101000001)
   INV-00003 - Empresa XYZ
   ```

3. **Seleccionar** la factura que deseas validar
4. **Click en "Probar"**

### Paso 4: Interpretar Resultados

#### ✅ Validación Exitosa

**Toast verde:**
```
✅ Validación exitosa! Estado: aprobado
```

**En la tabla de logs:**
- Status: 🟢 success
- Validation Result: 🟢 approved
- Duration: ~1500ms
- Response payload disponible

**La factura se actualiza automáticamente:**
- `numero_cfe` → "101000001"
- `serie_cfe` → "A"
- `dgi_estado` → "aprobado"
- `dgi_codigo_autorizacion` → "DGI-M0F2W4XS-M7UCAXQY"
- `status` → "validated"

#### ❌ Error en la Validación

**Toast rojo:**
```
❌ Error en validación: [mensaje del error]
```

**Errores comunes:**

1. **"No hay configuración activa disponible"**
   - Solución: Crear o activar una configuración

2. **"Factura no encontrada"**
   - Solución: Verificar que el ID de factura es correcto

3. **"Failed to fetch"** o **"Network error"**
   - Solución: Verificar URL de API
   - Verificar conectividad
   - Revisar CORS de la API externa

4. **"Timeout"**
   - La API no respondió en el tiempo configurado
   - Solución: Aumentar timeout en configuración

5. **"API returned non-2xx status"**
   - La API respondió pero con error (400, 401, 500, etc.)
   - Solución: Revisar logs para ver respuesta exacta
   - Verificar autenticación
   - Verificar formato del request

### Paso 5: Revisar Logs Detallados

1. Click en la pestaña **"Logs"**
2. Ver registro más reciente
3. Click en el ícono de **ojo (👁️)** para ver detalles completos

**Información disponible:**
- Request completo enviado a DGI
- Response completa recibida de DGI
- Headers utilizados
- Código de estado HTTP
- Tiempo de respuesta
- Número de reintentos

## Ejemplos de Uso

### Ejemplo 1: Validar Factura Borrador

```
1. Crear factura en estado "draft"
   - Cliente: ABC S.A.
   - Total: $2,420
   - Items: 2 productos

2. Ir a Settings → Validación Ext.

3. Seleccionar la factura en el dropdown:
   "INV-00045 - ABC S.A."

4. Click "Probar"

5. Esperar respuesta (1-3 segundos)

6. Si exitoso:
   - Factura pasa a "validated"
   - Aparece número CFE
   - Badge "DGI: aprobado"
   - Email enviado automáticamente (10 seg)

7. Verificar en tabla de facturas:
   - Columna "Número / CFE" muestra CFE
   - Columna "Estado" muestra badge verde DGI
```

### Ejemplo 2: Probar Configuración Nueva

```
1. Crear nueva configuración

2. Cargar template DGI Uruguay

3. Personalizar:
   - RUT emisor: tu RUT
   - Razón social: tu empresa

4. Guardar como activa

5. Seleccionar factura de prueba

6. Click "Probar"

7. Revisar logs:
   - Ver request enviado
   - Verificar mapeo correcto
   - Confirmar response recibida

8. Ajustar mapeo si es necesario
```

### Ejemplo 3: Diagnosticar Error de API

```
1. Seleccionar factura

2. Click "Probar"

3. Error: "API returned 401 Unauthorized"

4. Ir a pestaña "Logs"

5. Abrir último registro

6. Revisar "Request Payload"
   - Verificar estructura correcta
   - Confirmar campos requeridos

7. Revisar "Response Payload"
   - Ver mensaje de error de DGI
   - Identificar campo faltante o incorrecto

8. Corregir configuración:
   - Actualizar auth credentials
   - O ajustar request mapping

9. Probar nuevamente
```

## Verificar que Todo Funciona

### Checklist de Verificación

- [ ] Edge function desplegada y activa
  ```sql
  SELECT slug, status FROM supabase.functions
  WHERE slug = 'validate-invoice-external';
  ```

- [ ] Configuración activa existe
  ```sql
  SELECT * FROM external_invoice_api_config
  WHERE is_active = true;
  ```

- [ ] Facturas disponibles en dropdown
  ```sql
  SELECT id, invoice_number FROM invoices
  LIMIT 10;
  ```

- [ ] RLS permite lectura
  ```sql
  SELECT * FROM external_invoice_validation_log
  ORDER BY created_at DESC LIMIT 5;
  ```

- [ ] Trigger activo para emails
  ```sql
  SELECT tgname, tgenabled FROM pg_trigger
  WHERE tgname = 'trigger_queue_invoice_email_on_dgi_approval';
  ```

## Mejoras Implementadas

### 1. Selector de Facturas
- ✅ Dropdown en lugar de input texto
- ✅ Muestra número interno + cliente
- ✅ Indica CFE si ya existe
- ✅ Carga últimas 20 facturas
- ✅ Ordenadas por fecha descendente

### 2. Mensajes de Error Mejorados
- ✅ Distingue entre error de función y error de API
- ✅ Muestra mensaje específico del error
- ✅ Logs detallados en consola
- ✅ Emojis visuales (✅ / ❌)

### 3. UX Mejorada
- ✅ Texto explicativo sobre el selector
- ✅ Hint cuando se selecciona factura
- ✅ Botón deshabilitado si no hay selección
- ✅ Indicador de carga "Probando..."
- ✅ Recarga facturas después de validar

## Troubleshooting

### Dropdown vacío (sin facturas)

**Causa:** No hay facturas en el sistema

**Solución:**
```typescript
// Crear factura de prueba
const { data } = await supabase
  .from('invoices')
  .insert({
    invoice_number: 'TEST-001',
    client_id: 'cliente-id',
    issue_date: new Date().toISOString(),
    due_date: new Date().toISOString(),
    status: 'draft',
    subtotal: 1000,
    tax_amount: 220,
    total_amount: 1220
  });
```

### Error "Edge Function returned a non-2xx status code"

**Posibles causas:**
1. Factura no existe (404)
2. No hay configuración activa (404)
3. Error en la API externa (variable)
4. Timeout (504)

**Solución:**
1. Abrir DevTools → Console
2. Ver detalles del error
3. Ir a Logs para ver respuesta completa
4. Corregir según el error específico

### Validación exitosa pero factura no se actualiza

**Causa:** Mapeo de response incorrecto

**Solución:**
1. Ir a Logs
2. Ver "Response Payload" de DGI
3. Verificar estructura del JSON
4. Ajustar response mapping:
   ```
   Si DGI devuelve: { "data": { "numero": "123" } }
   Mapear: response.data.numero → numero_cfe
   ```

## Próximos Pasos

Una vez que la prueba es exitosa:

1. ✅ Configuración validada y funcional
2. ✅ Mapeo de campos correcto
3. ✅ Autenticación funcionando
4. ⏭️ Habilitar validación automática para ordenes
5. ⏭️ Configurar envío automático de emails
6. ⏭️ Monitorear logs regularmente
7. ⏭️ Agregar alertas para errores frecuentes

## Recursos Adicionales

- **DGI_INTEGRATION_GUIDE.md** - Guía completa de integración
- **EXTERNAL_VALIDATION_GUIDE.md** - Documentación del sistema
- **AUTO_INVOICE_EMAIL_SYSTEM.md** - Sistema de emails automáticos

## Soporte

Si encuentras problemas:

1. Revisar consola del navegador (F12)
2. Revisar logs en Supabase Dashboard
3. Verificar edge function logs
4. Consultar documentación arriba
5. Verificar configuración de RLS
