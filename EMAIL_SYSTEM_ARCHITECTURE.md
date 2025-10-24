# Arquitectura del Sistema de Emails y Comunicaciones

## 🎯 Filosofía del Sistema

**TODO el envío de emails y generación de PDFs se delega a sistemas externos (DogCatify).**

Este CRM NO envía emails directamente. Solo llama a APIs externas configuradas.

---

## ✅ Edge Functions ACTIVAS (Se usan)

### 1. `send-order-communication`
**Propósito**: Enviar comunicaciones de órdenes a través de API externa

**Cuándo se activa**: Automáticamente cuando una orden cambia a `confirmed`

**Qué hace**:
- Llama a la API externa de `pending-communication` (DogCatify)
- La API externa se encarga de:
  - Generar el PDF de la factura
  - Enviar el email al cliente
  - Retornar el estado del envío
- Actualiza la orden a `shipped` si todo sale bien
- Actualiza la orden a `sent-error-email` si hay error

**Configuración usada**: `email_communication` en `external_invoice_api_config`

---

### 2. `validate-invoice-external`
**Propósito**: Validar facturas con DGI (sistema tributario uruguayo)

**Cuándo se activa**: Automáticamente cuando se crea una factura en estado `draft`

**Qué hace**:
- Llama a la API externa de validación DGI
- Recibe aprobación o rechazo
- Actualiza la factura con los datos de DGI (CAE, QR, etc.)
- Actualiza el estado de la factura según respuesta

**Configuración usada**: `validation` en `external_invoice_api_config`

---

### 3. `dogcatify-order-webhook`
**Propósito**: Recibir órdenes desde DogCatify

**Cuándo se activa**: Cuando DogCatify envía un webhook con una nueva orden

**Qué hace**:
- Crea la orden en la base de datos
- Crea/actualiza el cliente asociado
- Crea el partner si viene en los datos
- Crea los items de la orden
- Retorna confirmación a DogCatify

---

### 4. `webhook-invoice-processed`
**Propósito**: Recibir notificaciones cuando una factura fue procesada externamente

**Cuándo se activa**: Cuando el sistema externo termina de procesar una factura

**Qué hace**:
- Actualiza el estado de la factura
- Registra el resultado en el log

---

### 5. Edge Functions de Twilio (para llamadas)
- `twilio-access-token`
- `twilio-connect-call`
- `twilio-inbound-webhook`
- `twilio-voice-webhook`
- `twilio-status-callback`
- `twilio-recording-callback`

**Propósito**: Sistema de llamadas VoIP

**Nota**: No tienen relación con emails, son para funcionalidad de llamadas telefónicas

---

### 6. Edge Functions del Inbox (para recibir emails)
- `sync-inbox-emails`: Sincroniza emails recibidos desde cuentas IMAP
- `send-inbox-email`: Envía respuestas a emails del inbox (diferente a facturas)

**Propósito**: Sistema de bandeja de entrada para gestión de emails

**Nota**: Estos son para la funcionalidad de CRM de gestión de emails, NO para envío de facturas

---

### 7. `send-campaign-emails`
**Propósito**: Envío de campañas de marketing

**Nota**: Para funcionalidad de campañas de CRM, NO relacionado con facturas

---

## ⛔ Edge Functions DESHABILITADAS (NO usar)

### ❌ `send-invoice-email`
**Estado**: DESHABILITADA - No llamar nunca

**Razón**: Enviaba emails de facturas directamente. Ahora se usa API externa.

---

### ❌ `send-invoice-pdf`
**Estado**: DESHABILITADA - No llamar nunca

**Razón**: Generaba PDFs usando PDFShift (servicio de pago sin créditos). Ahora se usa API externa.

---

### ❌ `process-invoice-email-queue`
**Estado**: DESHABILITADA - No llamar nunca

**Razón**: Procesaba la cola `invoice_email_queue`. Ya no se usa esa cola.

---

## 📊 Tablas del Sistema

### ✅ Tablas Activas

#### `external_invoice_api_config`
Configuraciones de todas las APIs externas

**Tipos de configuración**:
- `validation`: API de validación DGI
- `email_communication`: API de comunicación por email (órdenes)

#### `external_invoice_validation_log`
Historial completo de todas las llamadas a APIs externas

**Registra**:
- Validaciones DGI
- Comunicaciones de órdenes enviadas
- Requests y responses completos
- Tiempos de respuesta
- Estados y errores

#### `orders`
Órdenes del sistema

**Estados relacionados con comunicación**:
- `pending`: Orden creada, pendiente
- `confirmed`: Orden confirmada (trigger automático envía comunicación)
- `shipped`: Comunicación enviada exitosamente
- `sent-error-email`: Error al enviar comunicación

#### `invoices`
Facturas del sistema

**Estados relacionados**:
- `draft`: Borrador (trigger automático valida con DGI)
- `validated`: Aprobada por DGI
- `sent`: Enviada al cliente (por API externa)
- `sent-error`: Error al enviar
- `refused`: Rechazada por DGI

---

### ⛔ Tablas Deshabilitadas

#### `invoice_email_queue`
**Estado**: DESHABILITADA - Vacía

**Razón**: Ya no se usa. Todo se maneja vía API externa.

#### `invoice_pdf_queue`
**Estado**: DESHABILITADA - Vacía

**Razón**: Ya no se genera PDFs localmente. Se delega a API externa.

---

## 🔄 Flujo Completo del Sistema

### Flujo de Órdenes (DogCatify → CRM → Cliente)

1. **DogCatify recibe orden de cliente**
2. **DogCatify envía webhook** → `dogcatify-order-webhook`
3. **CRM crea orden** en estado `pending`
4. **DogCatify confirma pago** → webhook actualiza orden a `confirmed`
5. **Trigger automático** se dispara al cambiar a `confirmed`
6. **Edge function** `send-order-communication` llama a API externa `pending-communication`
7. **API externa (DogCatify)**:
   - Genera PDF de la factura
   - Envía email al cliente
   - Retorna resultado
8. **CRM actualiza orden**:
   - ✅ Si success → `shipped`
   - ❌ Si error → `sent-error-email`
9. **Log registrado** en `external_invoice_validation_log`

---

### Flujo de Facturas (Validación DGI)

1. **Sistema crea factura** en estado `draft`
2. **Trigger automático** se dispara
3. **Edge function** `validate-invoice-external` llama a API de DGI
4. **API DGI responde**:
   - ✅ Aprobada → Retorna CAE, QR, número CFE
   - ❌ Rechazada → Retorna error
5. **CRM actualiza factura**:
   - ✅ Si aprobada → `validated` + datos DGI
   - ❌ Si rechazada → `refused` + mensaje error
6. **Log registrado** en `external_invoice_validation_log`

---

## 🔧 Configuración de APIs Externas

### Configuración de Email Communication

```sql
INSERT INTO external_invoice_api_config (
  name,
  config_type,
  api_url,
  auth_type,
  auth_credentials,
  is_active
) VALUES (
  'DogCatify Pending Communication',
  'email_communication',
  'https://api.dogcatify.com/pending-communication',
  'api_key',
  '{"key": "x-api-key", "value": "tu_api_key_aqui"}',
  true
);
```

### Configuración de Validación DGI

```sql
INSERT INTO external_invoice_api_config (
  name,
  config_type,
  api_url,
  auth_type,
  auth_credentials,
  is_active
) VALUES (
  'DGI Uruguay',
  'validation',
  'https://api.dgi.gub.uy/validate',
  'bearer',
  '{"token": "tu_token_aqui"}',
  true
);
```

---

## 📝 Resumen

| Funcionalidad | Responsable | Estado |
|--------------|-------------|--------|
| Envío de emails de facturas | API Externa (DogCatify) | ✅ Activo |
| Generación de PDFs | API Externa (DogCatify) | ✅ Activo |
| Validación DGI | API Externa (DGI) | ✅ Activo |
| Registro de historial | `external_invoice_validation_log` | ✅ Activo |
| Envío directo de emails | ~~Edge functions~~ | ⛔ DESHABILITADO |
| Generación local de PDFs | ~~PDFShift~~ | ⛔ DESHABILITADO |
| Colas de email/PDF | ~~invoice_email_queue, invoice_pdf_queue~~ | ⛔ DESHABILITADO |

**Principio fundamental**: Este CRM es un orquestador que llama a APIs externas. No genera ni envía nada directamente.
