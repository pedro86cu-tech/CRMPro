# Guía de Validación Externa de Facturas

## Descripción General

El sistema de Validación Externa permite integrar el CRM con APIs externas para validar facturas automáticamente. Esta funcionalidad es útil para cumplir con requisitos fiscales o de auditoría externa.

## Características

- ✅ Configuración flexible de múltiples APIs
- ✅ Soporte para varios tipos de autenticación (Basic, Bearer Token, API Key)
- ✅ Mapeo personalizable de campos request/response
- ✅ Reintentos automáticos en caso de fallo
- ✅ Timeout configurable
- ✅ Historial completo de todas las validaciones
- ✅ Prueba de configuración antes de activar
- ✅ Logs detallados con request/response completos

## Acceso al Módulo

1. Navegue a **"Validación Ext."** en el menú lateral
2. Verá dos pestañas principales:
   - **Configuración**: Gestión de APIs externas
   - **Historial de Validaciones**: Log de todas las llamadas realizadas

## Configurar una Nueva API Externa

### 1. Crear Nueva Configuración

Click en el botón **"Nueva Configuración"** en la parte superior derecha.

### 2. Información Básica

- **Nombre**: Un nombre descriptivo para identificar la configuración
- **URL de API**: El endpoint completo donde se enviarán las solicitudes
- **Estado**: Activa/Inactiva (solo las activas se usarán)

### 3. Tipo de Autenticación

Seleccione el tipo de autenticación que requiere la API externa:

#### Sin Autenticación (none)
No se envía ningún header de autenticación.

#### Basic Auth (basic)
- **Usuario**: Nombre de usuario
- **Contraseña**: Contraseña

El sistema automáticamente codificará las credenciales en Base64 y las enviará en el header `Authorization: Basic [credenciales]`.

#### Bearer Token (bearer)
- **Bearer Token**: El token de autenticación

Se enviará como: `Authorization: Bearer [token]`

#### API Key (api_key)
- **Nombre del Header**: Nombre del header personalizado (ej: `X-API-Key`)
- **Valor del API Key**: El valor de la clave

Se enviará como: `[Header-Name]: [api-key-value]`

### 4. Configuraciones Avanzadas

- **Timeout (ms)**: Tiempo máximo de espera para la respuesta (default: 30000ms)
- **Reintentos**: Número de intentos en caso de fallo (default: 3)

### 5. Mapeo de Request

Define qué campos de la factura se enviarán a la API externa y con qué nombre.

**Formato JSON:**
```json
{
  "invoice_number": "invoice.invoice_number",
  "total_amount": "invoice.total_amount",
  "currency": "invoice.currency",
  "issue_date": "invoice.issue_date",
  "client_name": "invoice.clients.contact_name",
  "client_email": "invoice.clients.email"
}
```

**Explicación:**
- **Clave izquierda**: Nombre del campo que espera la API externa
- **Valor derecho**: Ruta al dato en tu sistema (siempre comienza con `invoice.`)

**Campos disponibles:**
- `invoice.invoice_number` - Número de factura
- `invoice.total_amount` - Monto total
- `invoice.subtotal` - Subtotal
- `invoice.tax_amount` - Monto de impuestos
- `invoice.discount_amount` - Monto de descuento
- `invoice.currency` - Moneda
- `invoice.issue_date` - Fecha de emisión
- `invoice.due_date` - Fecha de vencimiento
- `invoice.status` - Estado
- `invoice.clients.contact_name` - Nombre del cliente
- `invoice.clients.company_name` - Empresa del cliente
- `invoice.clients.email` - Email del cliente
- `invoice.clients.tax_id` - RUT/NIT del cliente
- `invoice.orders.order_number` - Número de orden asociada

### 6. Mapeo de Response

Define cómo interpretar la respuesta de la API externa.

**Formato JSON:**
```json
{
  "approved": "response.approved",
  "reference": "response.reference_id",
  "message": "response.message"
}
```

**Campos requeridos:**
- **approved**: Campo que indica si la factura fue aprobada (boolean)
- **reference**: ID o referencia externa asignada
- **message**: Mensaje de respuesta

## Probar la Configuración

Antes de activar una configuración, puede probarla:

1. En el modal de edición, vaya a la sección **"Probar Configuración"**
2. Ingrese un **ID de factura** válido de su sistema
3. Click en **"Probar"**
4. El sistema realizará una llamada real a la API y mostrará el resultado

## Historial de Validaciones

En la pestaña **"Historial de Validaciones"** podrá ver:

- **Fecha/Hora**: Cuándo se realizó la validación
- **Estado**: success, error, timeout
- **Resultado**: approved, rejected, pending, error
- **Referencia Externa**: ID asignado por el sistema externo
- **Duración**: Tiempo que tomó la llamada (en ms)
- **Reintentos**: Número de reintentos realizados

### Ver Detalles de una Validación

Click en **"Ver detalles"** para ver:
- Request payload completo enviado
- Response payload completo recibido
- Código HTTP de respuesta
- Mensajes de error (si los hay)
- Toda la información de la transacción

## Integración con Facturas

Una vez configurado, el sistema puede validar facturas de dos formas:

### 1. Manual
Desde el módulo de facturas, seleccione una factura y use la opción de validación.

### 2. Automática (Próximamente)
Configure reglas para validar automáticamente cuando se alcance cierto estado.

## Ejemplo de Integración Completa

### Caso: Validación con Sistema Tributario Nacional

**Configuración:**
```
Nombre: Sistema Tributario UY
URL: https://api.dgi.gub.uy/v1/validate-invoice
Autenticación: Bearer Token
Token: [su-token-aquí]
```

**Request Mapping:**
```json
{
  "nro_comprobante": "invoice.invoice_number",
  "monto_total": "invoice.total_amount",
  "moneda": "invoice.currency",
  "fecha_emision": "invoice.issue_date",
  "rut_cliente": "invoice.clients.tax_id",
  "razon_social": "invoice.clients.company_name"
}
```

**Response Mapping:**
```json
{
  "approved": "response.estado_validacion.aprobado",
  "reference": "response.cae",
  "message": "response.mensaje"
}
```

## Solución de Problemas

### Error: "No hay configuración activa disponible"
- Verifique que al menos una configuración esté marcada como **"Activa"**
- Solo una configuración puede estar activa a la vez

### Error: "Request timeout"
- Aumente el valor de **Timeout** en la configuración
- Verifique que la URL de la API sea correcta y esté accesible

### Error: "Invalid credentials"
- Revise las credenciales de autenticación
- Verifique que el tipo de autenticación sea el correcto

### La respuesta no se interpreta correctamente
- Verifique el **Response Mapping**
- Use la opción de **"Ver detalles"** en el log para ver la respuesta completa
- Ajuste las rutas del mapping según la estructura real de la respuesta

## Seguridad

- ✅ Las credenciales se almacenan de forma segura en la base de datos
- ✅ Las llamadas a APIs externas se realizan desde el servidor (edge functions)
- ✅ Nunca se exponen las credenciales en el frontend
- ✅ Todos los logs incluyen información completa para auditoría
- ✅ Row Level Security (RLS) protege el acceso a configuraciones y logs

## API de Validación (Edge Function)

**Endpoint:** `/functions/v1/validate-invoice-external`

**Método:** POST

**Body:**
```json
{
  "invoice_id": "uuid-de-la-factura",
  "config_id": "uuid-de-configuracion" // opcional
}
```

**Response:**
```json
{
  "success": true,
  "validation_result": "approved",
  "external_reference": "CAE-123456",
  "status": "success",
  "message": "Validación completada",
  "duration_ms": 1250,
  "retry_count": 0,
  "log_id": "uuid-del-log"
}
```

## Soporte

Para obtener ayuda adicional:
1. Revise el **Historial de Validaciones** para ver errores específicos
2. Verifique la documentación de la API externa que está integrando
3. Use la función de **"Probar"** para validar la configuración
