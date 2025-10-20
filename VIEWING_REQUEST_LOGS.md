# Cómo Ver el JSON Enviado y Recibido en la Consola

## 🎯 Objetivo

Ver exactamente qué JSON se envía a la API de DGI y qué respuesta se recibe, directamente en la consola del navegador.

## 📝 Pasos para Ver los Logs

### Paso 1: Abrir DevTools

**Windows/Linux:**
- Presionar `F12`
- O `Ctrl + Shift + I`
- O Click derecho → "Inspeccionar"

**Mac:**
- Presionar `Cmd + Option + I`
- O Click derecho → "Inspeccionar elemento"

### Paso 2: Ir a la Pestaña Console

1. En DevTools, buscar las pestañas: **Elements, Console, Sources, Network...**
2. Click en **"Console"**
3. Limpiar la consola (icono 🚫 o `Ctrl+L`)

### Paso 3: Ejecutar Prueba de Validación

1. Ir a **Settings** → **Validación Ext.**
2. Seleccionar una factura del dropdown
3. Click en **"Probar"**
4. Esperar respuesta

### Paso 4: Ver los Logs

En la consola aparecerán dos grupos colapsables:

```
📤 REQUEST ENVIADO A DGI
📥 RESPONSE RECIBIDA DE DGI
```

## 📦 Estructura de los Logs

### 📤 REQUEST ENVIADO A DGI

```javascript
📤 REQUEST ENVIADO A DGI
  🔹 Factura ID: "123e4567-e89b-12d3-a456-426614174000"
  🔹 Config ID: "987f6543-e21a-43d2-b654-321098765432"
  🔹 JSON enviado:
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

### 📥 RESPONSE RECIBIDA DE DGI

```javascript
📥 RESPONSE RECIBIDA DE DGI
  🔹 Status Code: 200
  🔹 Success: true
  🔹 Validation Result: "approved"
  🔹 JSON recibido:
  {
    "success": true,
    "estado": "aprobado",
    "codigo_autorizacion": "DGI-MGYEAIN1-0L5DB8KZ",
    "numero_cfe": "101000001",
    "serie": "A",
    "fecha_validacion": "2025-10-20T00:26:22.881Z",
    "mensaje": "E-Factura validada y aprobada exitosamente por DGI",
    "id_efactura": "4a665dff-2622-4133-b185-7ad73173edc6"
  }
```

## 🖥️ Captura de Pantalla del Log

```
Console (×)  ⚠️ 📋 🚫

📤 REQUEST ENVIADO A DGI  ▼
  🔹 Factura ID: "uuid-here"
  🔹 Config ID: "uuid-here"
  🔹 JSON enviado:
  {
    "numero_cfe": "101000001",
    "serie": "A",
    ...
    "items": [...],
    "datos_adicionales": {...}
  }

📥 RESPONSE RECIBIDA DE DGI  ▼
  🔹 Status Code: 200
  🔹 Success: true
  🔹 Validation Result: "approved"
  🔹 JSON recibido:
  {
    "success": true,
    "estado": "aprobado",
    ...
  }

✅ Referencia externa: DGI-MGYEAIN1-0L5DB8KZ
```

## 🔍 Copiar JSON al Portapapeles

### Método 1: Desde la Consola

1. **Expandir el grupo** (click en la flecha ▼)
2. **Click derecho** en el objeto JSON
3. **"Copy object"** o **"Copiar objeto"**
4. Pegar en tu editor (Ctrl+V)

### Método 2: Selección Manual

1. **Expandir el grupo**
2. **Seleccionar el texto** del JSON
3. **Copiar** (Ctrl+C)
4. Pegar donde necesites

### Método 3: Usar copy()

En la consola, después de ver el log:

```javascript
// Copiar el último request enviado
copy(JSON.parse('PEGA_AQUI_EL_JSON'))
```

## 📊 Qué Información Ver

### Verificar Request Enviado

**Campos a verificar:**
- ✅ `numero_cfe` - ¿Tiene valor?
- ✅ `items` - ¿Es un array con productos?
- ✅ `datos_adicionales` - ¿Es un objeto?
- ✅ `total`, `subtotal`, `iva` - ¿Valores correctos?
- ✅ Todos los campos requeridos por DGI presentes

### Verificar Response Recibida

**Campos importantes:**
- ✅ `success` - true/false
- ✅ `estado` - "aprobado" / "rechazado"
- ✅ `codigo_autorizacion` - Código DGI
- ✅ `mensaje` - Descripción del resultado
- ✅ `id_efactura` - ID único de DGI

## 🐛 Troubleshooting

### No Aparecen los Logs

**Problema:** La consola está vacía después de probar

**Solución:**
1. Asegurarte de que DevTools esté abierto **antes** de hacer la prueba
2. Verificar que estés en la pestaña **"Console"**
3. Desactivar filtros (verificar que no esté filtrado por "Errors" solamente)

### Logs Colapsados

**Problema:** Solo veo "📤 REQUEST ENVIADO A DGI" sin contenido

**Solución:**
1. **Click en la flecha** ▶ para expandir
2. O **Click en el título** del grupo

### JSON Aparece en Una Línea

**Problema:** El JSON está todo en una línea, difícil de leer

**Solución:**
```javascript
// En la consola, copiar y formatear:
JSON.stringify(data.request_payload, null, 2)
```

O simplemente expandir el objeto haciendo click en las flechas.

### No Puedo Copiar el JSON

**Problema:** Al seleccionar, no se copia correctamente

**Solución 1 - Copy Object:**
1. Click derecho en el objeto
2. "Copy object"
3. Pegar en editor de texto

**Solución 2 - Store as Global:**
1. Click derecho en el objeto
2. "Store as global variable"
3. Se crea variable `temp1`
4. En consola: `copy(temp1)`

## 📋 Ejemplo Completo de Sesión

### 1. Antes de Probar

```
Console está limpia
```

### 2. Durante la Prueba

```
Console:
⏳ Enviando request a DGI...
```

### 3. Después de la Prueba (Exitosa)

```
Console:

📤 REQUEST ENVIADO A DGI  ▼
  🔹 Factura ID: "uuid"
  🔹 Config ID: "uuid"
  🔹 JSON enviado:
  { ...JSON completo... }

📥 RESPONSE RECIBIDA DE DGI  ▼
  🔹 Status Code: 200
  🔹 Success: true
  🔹 Validation Result: "approved"
  🔹 JSON recibido:
  { ...JSON completo... }

✅ Referencia externa: DGI-MGYEAIN1-0L5DB8KZ
```

### 4. Después de la Prueba (Con Error)

```
Console:

📤 REQUEST ENVIADO A DGI  ▼
  🔹 Factura ID: "uuid"
  🔹 Config ID: "uuid"
  🔹 JSON enviado:
  { ...JSON completo... }

📥 RESPONSE RECIBIDA DE DGI  ▼
  🔹 Status Code: 500
  🔹 Success: false
  🔹 Validation Result: "error"
  🔹 JSON recibido:
  {
    "error": "Internal Server Error",
    "message": "Campo requerido faltante"
  }

🔍 Detalles del Error de Validación  ▼
  Error completo: {...}
  Status code: 500
  Mensaje: "HTTP 500"
  Request enviado: {...}
  Response recibida: {...}
```

## 💡 Tips Útiles

### Mantener DevTools Abierto

Si DevTools se cierra automáticamente, puedes:

1. **Abrir en ventana separada:**
   - Click en ⋮ (tres puntos en DevTools)
   - "Undock into separate window"
   - Ahora DevTools está en su propia ventana

2. **Anclar a la derecha:**
   - Click en ⋮
   - Elegir posición (bottom, left, right)

### Filtrar Logs

Si hay muchos logs, puedes filtrar:

```
// En el campo "Filter" de Console:
REQUEST
```

O:

```
RESPONSE
```

### Guardar Logs

Para guardar los logs permanentemente:

1. Click derecho en la consola
2. "Save as..."
3. Guardar como archivo `.log`

### Ver Network Request

También puedes ver el request en la pestaña **Network**:

1. Ir a **Network** en DevTools
2. Probar la validación
3. Buscar request a `validate-invoice-external`
4. Click en el request
5. Ver **"Payload"** (request) y **"Response"** (respuesta)

## 🎯 Checklist Rápido

Antes de reportar un problema, verificar:

- [ ] DevTools está abierto (F12)
- [ ] Estoy en pestaña "Console"
- [ ] He ejecutado la prueba
- [ ] Veo los grupos "📤 REQUEST" y "📥 RESPONSE"
- [ ] He expandido los grupos
- [ ] He copiado ambos JSONs
- [ ] He revisado si falta algún campo
- [ ] He comparado con la documentación de DGI

## 🔗 Recursos Relacionados

- **ADVANCED_MAPPING_GUIDE.md** - Cómo configurar el mapeo
- **DGI_INTEGRATION_GUIDE.md** - Integración completa
- **WEBHOOK_TROUBLESHOOTING_HTTP500.md** - Solución de errores

---

**Versión:** 1.0
**Última actualización:** 2025-10-20
