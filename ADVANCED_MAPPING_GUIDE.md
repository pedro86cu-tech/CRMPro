# Guía de Mapeo Avanzado - Validación Externa DGI

## 🎯 Nuevas Capacidades

El sistema de mapeo ahora soporta:

1. ✅ **Arrays de items** (order_items)
2. ✅ **Objetos anidados complejos** (datos_adicionales)
3. ✅ **Headers dinámicos con variables** (Authorization con token)
4. ✅ **Campos simples** (como antes)

## 📦 Contexto Disponible

El sistema ahora tiene acceso a:

```javascript
{
  invoice: {...},        // Datos de la factura
  client: {...},         // Datos del cliente
  order: {...},          // Datos de la orden
  items: [...]           // Array de order_items
}
```

## 🔧 Tipos de Mapeo

### 1. Campos Simples (Como Antes)

**Uso:** Mapear un campo directo de la factura.

**Sintaxis:**
```json
{
  "campo_destino": "path.del.origen"
}
```

**Ejemplo:**
```json
{
  "numero_cfe": "invoice.invoice_number",
  "total": "invoice.total_amount",
  "rut_emisor": "invoice.rut_emisor",
  "rut_receptor": "client.document_number",
  "razon_social_receptor": "client.company_name"
}
```

### 2. Arrays de Items (NUEVO)

**Uso:** Mapear todos los items de una orden.

**Sintaxis:**
```json
{
  "items": {
    "_type": "array",
    "_source": "items",
    "_mapping": {
      "campo_destino": "campo_origen"
    }
  }
}
```

**Ejemplo:**
```json
{
  "items": {
    "_type": "array",
    "_source": "items",
    "_mapping": {
      "descripcion": "product_name",
      "cantidad": "quantity",
      "precio_unitario": "unit_price",
      "iva_porcentaje": "tax_rate",
      "total": "total_price"
    }
  }
}
```

**Esto genera:**
```json
{
  "items": [
    {
      "descripcion": "Producto de ejemplo",
      "cantidad": 1,
      "precio_unitario": 2000,
      "iva_porcentaje": 22,
      "total": 2420
    }
  ]
}
```

### 3. Objetos Anidados (NUEVO)

**Uso:** Agrupar campos en un objeto.

**Sintaxis:**
```json
{
  "objeto_destino": {
    "_type": "object",
    "_mapping": {
      "campo1": "path.origen1",
      "campo2": "path.origen2"
    }
  }
}
```

**Ejemplo:**
```json
{
  "datos_adicionales": {
    "_type": "object",
    "_mapping": {
      "observaciones": "invoice.notes",
      "forma_pago": "order.payment_method"
    }
  }
}
```

**Esto genera:**
```json
{
  "datos_adicionales": {
    "observaciones": "Información adicional",
    "forma_pago": "Contado"
  }
}
```

### 4. Headers Dinámicos (NUEVO)

**Uso:** Inyectar valores desde la base de datos en headers.

**Sintaxis:**
```json
{
  "Authorization": "Bearer {{invoice.auth_token}}"
}
```

O usar variables del contexto:
```json
{
  "X-RUT-Emisor": "{{invoice.rut_emisor}}",
  "X-Client-ID": "{{client.id}}"
}
```

## 📝 Ejemplo Completo: Configuración DGI Uruguay

### Request Mapping Completo

```json
{
  "numero_cfe": "invoice.invoice_number",
  "serie": "invoice.serie_cfe",
  "tipo_cfe": "invoice.tipo_cfe",
  "rut_emisor": "invoice.rut_emisor",
  "razon_social_emisor": "invoice.company_name",
  "rut_receptor": "client.document_number",
  "razon_social_receptor": "client.company_name",
  "fecha_emision": "invoice.issue_date",
  "moneda": "invoice.currency",
  "total": "invoice.total_amount",
  "subtotal": "invoice.subtotal",
  "iva": "invoice.tax_amount",
  "items": {
    "_type": "array",
    "_source": "items",
    "_mapping": {
      "descripcion": "product_name",
      "cantidad": "quantity",
      "precio_unitario": "unit_price",
      "iva_porcentaje": "tax_rate",
      "total": "total_price"
    }
  },
  "datos_adicionales": {
    "_type": "object",
    "_mapping": {
      "observaciones": "invoice.notes",
      "forma_pago": "order.payment_method"
    }
  }
}
```

### Headers Configuration

En el campo "Headers Personalizados" (JSON):

```json
{
  "Authorization": "Bearer eyJhbGc...",
  "X-RUT-Emisor": "211234567001"
}
```

O con variables dinámicas:

```json
{
  "Authorization": "Bearer {{invoice.api_token}}"
}
```

### Response Mapping

```json
{
  "approved": "response.success",
  "numero_cfe": "response.numero_cfe",
  "serie_cfe": "response.serie",
  "dgi_estado": "response.estado",
  "dgi_codigo_autorizacion": "response.codigo_autorizacion",
  "dgi_mensaje": "response.mensaje",
  "dgi_id_efactura": "response.id_efactura",
  "dgi_fecha_validacion": "response.fecha_validacion"
}
```

## 🎬 Caso de Uso Real

### Escenario

Necesitas enviar una factura a DGI con:
- Datos básicos de la factura
- Información del cliente
- Lista de productos comprados
- Observaciones adicionales

### Request Esperado por DGI

```json
{
  "numero_cfe": "101000001",
  "serie": "A",
  "tipo_cfe": "eFactura",
  "rut_emisor": "211234567001",
  "razon_social_emisor": "Empresa Demo S.A.",
  "rut_receptor": "219876540015",
  "razon_social_receptor": "Cliente Ejemplo S.R.L.",
  "fecha_emision": "2025-10-19T20:00:00.000Z",
  "moneda": "UYU",
  "total": 2420,
  "subtotal": 2000,
  "iva": 420,
  "items": [
    {
      "descripcion": "Producto de ejemplo",
      "cantidad": 1,
      "precio_unitario": 2000,
      "iva_porcentaje": 22,
      "total": 2420
    }
  ],
  "datos_adicionales": {
    "observaciones": "Información adicional",
    "forma_pago": "Contado"
  }
}
```

### Configuración del Mapeo

**1. Campos Simples:**
```json
{
  "numero_cfe": "invoice.invoice_number",
  "serie": "invoice.serie_cfe",
  "rut_emisor": "invoice.rut_emisor",
  "rut_receptor": "client.document_number",
  "total": "invoice.total_amount"
}
```

**2. Array de Items:**
```json
{
  "items": {
    "_type": "array",
    "_source": "items",
    "_mapping": {
      "descripcion": "product_name",
      "cantidad": "quantity",
      "precio_unitario": "unit_price",
      "iva_porcentaje": "tax_rate",
      "total": "total_price"
    }
  }
}
```

**3. Objeto Adicional:**
```json
{
  "datos_adicionales": {
    "_type": "object",
    "_mapping": {
      "observaciones": "invoice.notes",
      "forma_pago": "order.payment_method"
    }
  }
}
```

**4. Headers:**
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## 🔍 Cómo Probar

### Paso 1: Configurar Mapeo

1. Ir a **Settings** → **Validación Ext.**
2. Crear/Editar configuración
3. En **Request Mapping**, pegar el JSON completo:

```json
{
  "numero_cfe": "invoice.invoice_number",
  "serie": "invoice.serie_cfe",
  "tipo_cfe": "invoice.tipo_cfe",
  "rut_emisor": "invoice.rut_emisor",
  "razon_social_emisor": "invoice.company_name",
  "rut_receptor": "client.document_number",
  "razon_social_receptor": "client.company_name",
  "fecha_emision": "invoice.issue_date",
  "moneda": "invoice.currency",
  "total": "invoice.total_amount",
  "subtotal": "invoice.subtotal",
  "iva": "invoice.tax_amount",
  "items": {
    "_type": "array",
    "_source": "items",
    "_mapping": {
      "descripcion": "product_name",
      "cantidad": "quantity",
      "precio_unitario": "unit_price",
      "iva_porcentaje": "tax_rate",
      "total": "total_price"
    }
  },
  "datos_adicionales": {
    "_type": "object",
    "_mapping": {
      "observaciones": "invoice.notes",
      "forma_pago": "order.payment_method"
    }
  }
}
```

### Paso 2: Configurar Headers

En **"Headers Personalizados (JSON)"**:

```json
{
  "Authorization": "Bearer TU_TOKEN_AQUI"
}
```

### Paso 3: Guardar y Probar

1. Guardar configuración
2. Seleccionar factura del dropdown
3. Click "Probar"
4. Abrir F12 → Console
5. Ver el request generado

### Paso 4: Verificar Request

En la consola deberías ver:

```
Request payload: {
  "numero_cfe": "101000001",
  "items": [
    {
      "descripcion": "Producto...",
      "cantidad": 1,
      ...
    }
  ],
  "datos_adicionales": {
    ...
  }
}
```

## 🐛 Troubleshooting

### Items No Aparecen

**Problema:** El array `items` está vacío `[]`

**Causas:**
1. La factura no tiene `order_id` asociado
2. No hay items en `order_items` para esa orden

**Solución:**
```sql
-- Verificar items de la orden
SELECT oi.*
FROM order_items oi
JOIN invoices i ON i.order_id = oi.order_id
WHERE i.id = 'TU_INVOICE_ID';
```

### Campos Undefined/Null

**Problema:** Campos aparecen como `null` o `undefined`

**Causas:**
1. Path incorrecto en el mapeo
2. Campo no existe en la base de datos

**Solución:**
```javascript
// En consola del navegador, verificar estructura:
console.log(data.request_payload);

// Verificar que el path sea correcto:
// ✅ "client.document_number"
// ❌ "invoice.client.document_number" (incorrecto)
```

### Headers No Se Envían

**Problema:** Header Authorization no llega a la API

**Causa:** El header se configura en "Headers Personalizados" pero también tienes autenticación configurada

**Solución:**
- Si usas Bearer token, ponlo en **Auth Type → Bearer**
- O déjalo en Headers y pon Auth Type en **"none"**

### Objetos Anidados Mal Formateados

**Problema:**
```json
{
  "datos_adicionales.observaciones": "valor"
}
```

En lugar de:
```json
{
  "datos_adicionales": {
    "observaciones": "valor"
  }
}
```

**Causa:** Falta `_type: "object"` en la configuración

**Solución:**
```json
{
  "datos_adicionales": {
    "_type": "object",  // ← Esto es necesario
    "_mapping": {
      "observaciones": "invoice.notes"
    }
  }
}
```

## 📊 Campos Disponibles

### Desde `invoice`
- `invoice.id`
- `invoice.invoice_number`
- `invoice.numero_cfe`
- `invoice.serie_cfe`
- `invoice.tipo_cfe`
- `invoice.issue_date`
- `invoice.due_date`
- `invoice.subtotal`
- `invoice.tax_amount`
- `invoice.total_amount`
- `invoice.currency`
- `invoice.notes`
- `invoice.status`
- `invoice.rut_emisor`
- `invoice.company_name`
- Y todos los demás campos de la tabla `invoices`

### Desde `client`
- `client.id`
- `client.contact_name`
- `client.company_name`
- `client.email`
- `client.phone`
- `client.document_number`
- `client.document_type`
- `client.address`
- Y todos los campos de la tabla `clients`

### Desde `order`
- `order.id`
- `order.order_number`
- `order.payment_method`
- `order.payment_status`
- `order.shipping_address`
- Y todos los campos de la tabla `orders`

### Desde `items` (array)
- `product_name`
- `description`
- `quantity`
- `unit_price`
- `tax_rate`
- `total_price`
- `currency`
- Y todos los campos de la tabla `order_items`

## 💡 Tips y Mejores Prácticas

### 1. Probar Paso a Paso

Empieza simple y agrega complejidad:

```json
// Paso 1: Solo campos simples
{
  "numero": "invoice.invoice_number",
  "total": "invoice.total_amount"
}

// Paso 2: Agregar items
{
  ...,
  "items": {
    "_type": "array",
    "_source": "items",
    "_mapping": {
      "descripcion": "product_name"
    }
  }
}

// Paso 3: Agregar objetos
{
  ...,
  "datos_adicionales": {
    "_type": "object",
    "_mapping": {
      "observaciones": "invoice.notes"
    }
  }
}
```

### 2. Usar httpbin.org para Debugging

```
URL: https://httpbin.org/post
```

Esta URL devuelve exactamente lo que envías, perfecto para verificar el request.

### 3. Ver Logs Detallados

Después de probar:
1. Ir a pestaña "Logs"
2. Abrir último registro
3. Ver "Request Payload" completo

### 4. Campos Opcionales

Si un campo puede ser null, la API lo recibirá como `null`.
Si eso causa problemas, puedes usar valores por defecto en la base de datos.

## 🎓 Ejemplos Adicionales

### Ejemplo: Múltiples Arrays

```json
{
  "items": {
    "_type": "array",
    "_source": "items",
    "_mapping": {
      "nombre": "product_name",
      "precio": "unit_price"
    }
  },
  "pagos": {
    "_type": "array",
    "_source": "payments",
    "_mapping": {
      "monto": "amount",
      "metodo": "method"
    }
  }
}
```

### Ejemplo: Objetos Anidados Profundos

```json
{
  "datos": {
    "_type": "object",
    "_mapping": {
      "cliente": {
        "_type": "object",
        "_mapping": {
          "nombre": "client.contact_name",
          "documento": "client.document_number"
        }
      },
      "factura": {
        "_type": "object",
        "_mapping": {
          "numero": "invoice.invoice_number",
          "total": "invoice.total_amount"
        }
      }
    }
  }
}
```

### Ejemplo: Calcular Valores

Actualmente no soportado, pero en roadmap:

```json
{
  "total_con_descuento": "{{invoice.total_amount * 0.9}}"
}
```

## 🚀 Próximas Mejoras

- [ ] Transformaciones (uppercase, lowercase, format fecha)
- [ ] Cálculos matemáticos inline
- [ ] Condicionales (if/else)
- [ ] Valores por defecto
- [ ] Validaciones previas al envío

## 📞 Soporte

Si tienes problemas:
1. Revisar consola (F12)
2. Ver logs de validación
3. Verificar documentación de DGI
4. Consultar esta guía

## 📚 Recursos

- **DGI_INTEGRATION_GUIDE.md** - Integración completa con DGI
- **TESTING_DGI_VALIDATION.md** - Cómo probar validaciones
- **WEBHOOK_TROUBLESHOOTING_HTTP500.md** - Solución de errores

---

**Versión:** 2.0
**Fecha:** 2025-10-20
**Cambios:** Agregado soporte para arrays, objetos anidados y headers dinámicos
