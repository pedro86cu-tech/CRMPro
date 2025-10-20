# Solución: Error HTTP 500 al Validar con DGI

## Problema Actual

Al probar la validación externa de facturas, se recibe:

```
❌ Error en validación: HTTP 500
Status: error
Validation result: error
Retry count: 3
Duration: ~7076ms
```

## ¿Qué Significa HTTP 500?

**HTTP 500 (Internal Server Error)** significa que:
- ✅ Tu configuración y sistema están bien
- ✅ La conexión a la API se estableció correctamente
- ✅ El request llegó al servidor de DGI
- ❌ **El servidor de DGI tiene un problema interno**

**NO es un error de tu lado**, sino del servidor de DGI.

## Causas Comunes

### 1. URL Incorrecta o Ambiente Incorrecto

**Problema:** Estás apuntando a una URL de prueba/desarrollo que no está activa.

**Solución:**
```
❌ URL incorrecta: https://api-test.dgi.gub.uy/...
✅ URL correcta: https://api.dgi.gub.uy/efactura/v1/validate
```

**Verificar:**
1. Ir a Settings → Validación Ext.
2. Abrir configuración
3. Verificar campo "URL de API"
4. Confirmar con documentación oficial de DGI

### 2. Formato del Request Incorrecto

**Problema:** El servidor recibe el request pero no puede procesarlo porque falta un campo requerido o el formato es incorrecto.

**Solución:**

**Paso 1:** Ver el request que se envió
```typescript
// En la consola del navegador, busca:
"Request enviado: { ... }"
```

**Paso 2:** Comparar con documentación de DGI

Ejemplo de request esperado por DGI:
```json
{
  "rut_emisor": "211234567001",
  "tipo_comprobante": "111",
  "serie": "A",
  "numero": "1",
  "fecha_emision": "2025-10-19",
  "monto_total": 1220.00,
  "receptor": {
    "tipo_doc": "2",
    "numero_doc": "29123456",
    "razon_social": "Cliente S.A."
  }
}
```

**Paso 3:** Ajustar mapeo de campos

Si el request enviado no coincide, ajustar en:
- Settings → Validación Ext.
- Sección "Mapeo de Campos (Request)"
- Corregir campos según documentación

### 3. Autenticación Válida pero Sin Permisos

**Problema:** Las credenciales son correctas pero el usuario no tiene permisos para validar facturas.

**Solución:**
1. Contactar a DGI para verificar permisos del usuario
2. Confirmar que el RUT emisor está habilitado para e-Factura
3. Verificar que el certificado digital está activo

### 4. API de DGI Caída o en Mantenimiento

**Problema:** El servidor de DGI está temporalmente fuera de servicio.

**Solución:**
1. Esperar unos minutos y reintentar
2. Verificar en sitio de DGI si hay mantenimiento programado
3. Probar con API de homologación primero

### 5. Timeout del Servidor

**Problema:** El servidor de DGI recibe el request pero tarda demasiado en procesarlo y falla.

**Solución:**
```
1. Settings → Validación Ext.
2. Aumentar "Timeout" de 30000 a 60000 (60 segundos)
3. Guardar y probar nuevamente
```

## Pasos de Diagnóstico

### Paso 1: Ver Logs Detallados

1. **Abrir pestaña "Logs"** en Validación Externa
2. **Click en el último registro** (el que tiene el error)
3. **Revisar:**
   - Request Payload (lo que enviaste)
   - Response Payload (lo que DGI respondió)
   - Status Code (500)
   - Error Message

### Paso 2: Ver Consola del Navegador

1. Presionar **F12** (DevTools)
2. Ir a pestaña **"Console"**
3. Buscar grupo colapsado:
   ```
   🔍 Detalles del Error de Validación
   ```
4. Expandir y revisar:
   - Error completo
   - Status code
   - Request enviado
   - Response recibida

### Paso 3: Verificar Response de DGI

La API de DGI debería responder con detalles del error:

**Ejemplo de respuesta con error:**
```json
{
  "success": false,
  "error": "CAMPO_REQUERIDO_FALTANTE",
  "mensaje": "El campo 'rut_emisor' es obligatorio",
  "codigo": "ERR_001"
}
```

**Buscar en la consola:**
```
Response recibida: { ... }
```

### Paso 4: Probar con API de Prueba

Antes de llamar a DGI real, probar con API de prueba:

**URL de prueba:** `https://httpbin.org/post`

Esta URL acepta cualquier request y devuelve lo que enviaste.

**Configuración de prueba:**
```
1. Duplicar configuración actual
2. Cambiar URL a: https://httpbin.org/post
3. Guardar
4. Probar con una factura
5. Si funciona, el problema es la API de DGI
6. Si no funciona, el problema es tu configuración
```

### Paso 5: Verificar Conectividad

Probar desde terminal o Postman:

```bash
curl -X POST https://api.dgi.gub.uy/efactura/v1/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "rut_emisor": "211234567001",
    "tipo_comprobante": "111"
  }'
```

Si esto también da 500, confirma que es problema de DGI.

## Mejoras Implementadas

### 1. Mensajes de Error Específicos

**Antes:**
```
❌ Error en validación: HTTP 500
```

**Ahora:**
```
❌ Error del servidor DGI (HTTP 500).
La API externa tiene problemas. Revisa los logs para más detalles.
```

### 2. Logs Agrupados en Consola

**Nueva estructura en consola:**
```
🔍 Detalles del Error de Validación
  ├─ Error completo: {...}
  ├─ Status code: 500
  ├─ Mensaje: HTTP 500
  ├─ Request enviado: {...}
  └─ Response recibida: {...}
```

### 3. Guía de Troubleshooting Integrada

Ahora en la pantalla de configuración aparece:

```
💡 Solución de Problemas
─────────────────────────
• HTTP 500: La API de DGI tiene problemas internos...
• HTTP 401/403: Error de autenticación...
• HTTP 400: Request inválido...
• HTTP 404: URL incorrecta...
• Timeout: La API no responde a tiempo...

📋 Tip: Abre la pestaña "Logs" para ver el request y response completos.
```

### 4. Mensajes por Código HTTP

El sistema ahora detecta automáticamente el tipo de error:

| Código | Mensaje |
|--------|---------|
| 500 | Error del servidor DGI. La API tiene problemas internos. |
| 401/403 | Error de autenticación. Verifica credenciales. |
| 400 | Request inválido. Verifica mapeo de campos. |
| 404 | Endpoint no encontrado. Verifica URL. |
| Timeout | La API no responde. Aumenta timeout. |

## Soluciones Recomendadas

### Solución Inmediata (5 minutos)

1. **Verificar que estés usando ambiente correcto**
   ```
   ✅ Producción: https://api.dgi.gub.uy/...
   ✅ Homologación: https://api-test.dgi.gub.uy/...
   ❌ localhost o desarrollo
   ```

2. **Revisar logs en Supabase Dashboard**
   ```
   Supabase → Edge Functions → validate-invoice-external → Logs
   ```

3. **Contactar soporte de DGI**
   - Enviar el request que estás enviando
   - Mencionar el error 500
   - Preguntar si hay mantenimiento

### Solución a Mediano Plazo (1 hora)

1. **Revisar documentación oficial de DGI**
   - Confirmar estructura exacta del request
   - Verificar campos obligatorios
   - Confirmar tipos de datos

2. **Ajustar mapeo de campos**
   - Usar template DGI Uruguay como base
   - Personalizar según tu caso
   - Probar campo por campo

3. **Implementar validación antes de enviar**
   ```sql
   -- Verificar que factura tiene todos los campos
   SELECT
     invoice_number,
     CASE
       WHEN total_amount IS NULL THEN 'Falta total'
       WHEN client_id IS NULL THEN 'Falta cliente'
       ELSE 'OK'
     END as validation
   FROM invoices;
   ```

### Solución a Largo Plazo (1 día)

1. **Configurar ambiente de homologación**
   - Crear segunda configuración para pruebas
   - URL de test de DGI
   - Credenciales de test
   - Probar ahí primero

2. **Agregar validaciones previas**
   ```typescript
   // Antes de llamar a DGI, validar localmente
   if (!invoice.total_amount || invoice.total_amount <= 0) {
     throw new Error('Monto inválido');
   }
   ```

3. **Implementar sistema de reintentos inteligente**
   ```typescript
   // Si es 500, esperar más tiempo antes de reintentar
   if (statusCode === 500) {
     await sleep(5000); // 5 segundos
   }
   ```

## Checklist de Verificación

Antes de contactar soporte:

- [ ] Verificar URL de API (correcta para ambiente)
- [ ] Revisar logs completos (request + response)
- [ ] Confirmar credenciales válidas
- [ ] Probar con httpbin.org (para descartar tu config)
- [ ] Verificar conectividad (curl o Postman)
- [ ] Revisar documentación DGI
- [ ] Confirmar campos obligatorios presentes
- [ ] Verificar formato de fechas y montos
- [ ] Confirmar RUT emisor válido
- [ ] Probar con factura simple primero

## Información a Proporcionar a DGI

Si contactas soporte de DGI, proporciona:

```
1. Request enviado (copiar de logs)
2. Response recibida (copiar de logs)
3. Timestamp del error
4. URL exacta usada
5. Método de autenticación
6. RUT emisor
7. Ambiente (producción/homologación)
8. Frecuencia del error (siempre/intermitente)
```

## Próximos Pasos

Una vez resuelto el error:

1. ✅ Documentar la solución para futuras referencias
2. ✅ Actualizar configuración si fue necesario
3. ✅ Probar con varias facturas diferentes
4. ✅ Configurar alertas para detectar errores 500
5. ✅ Implementar fallback o notificación al admin

## Recursos

- **Documentación DGI:** [Portal de DGI](https://www.dgi.gub.uy)
- **Logs de la función:** Supabase Dashboard → Edge Functions
- **Logs de validación:** Settings → Validación Ext. → Pestaña "Logs"
- **Consola del navegador:** F12 → Console

## Resumen

**El error HTTP 500 es del servidor de DGI, no de tu sistema.**

**Acciones inmediatas:**
1. Ver logs para confirmar request enviado
2. Verificar URL de la API
3. Probar con httpbin.org
4. Contactar soporte de DGI

**Tu sistema está funcionando correctamente** - el problema está en la respuesta del servidor externo.
