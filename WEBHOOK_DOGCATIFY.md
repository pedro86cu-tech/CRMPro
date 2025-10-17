# Webhook DogCatify - Documentación

## Configuración

### 1. URL del Webhook

La URL del webhook que debes registrar en DogCatify es:

```
https://satzkpynnuloncwgxeev.supabase.co/functions/v1/dogcatify-order-webhook
```

### 2. Configurar el Secret (Opcional)

Si DogCatify usa una firma HMAC SHA-256 para verificar las peticiones, debes configurar el secret en las variables de entorno de Supabase:

1. Ve al Dashboard de Supabase: https://supabase.com/dashboard/project/satzkpynnuloncwgxeev/settings/functions
2. En la sección "Edge Functions Secrets", agrega:
   - Key: `DOGCATIFY_WEBHOOK_SECRET`
   - Value: El secret proporcionado por DogCatify

### 3. Variables de Entorno

Las siguientes variables están configuradas en el archivo `.env`:

```env
DOGCATIFY_WEBHOOK_SECRET=your_webhook_secret_here
DOGCATIFY_WEBHOOK_URL=https://satzkpynnuloncwgxeev.supabase.co/functions/v1/dogcatify-order-webhook
```

## Eventos Soportados

El webhook maneja los siguientes eventos:

### 1. `order.created`
Se dispara cuando se crea una nueva orden en DogCatify.

**Acciones:**
- Busca o crea el cliente basado en `customer_id`
- Crea la orden en la tabla `orders`
- Crea los items de la orden en la tabla `order_items`

### 2. `order.updated`
Se dispara cuando se actualiza una orden existente.

**Acciones:**
- Busca la orden por `external_order_id`
- Actualiza el estado, payment_status y total_amount

### 3. `order.cancelled`
Se dispara cuando se cancela una orden.

**Acciones:**
- Busca la orden por `external_order_id`
- Actualiza el status a "cancelled"

### 4. `order.completed`
Se dispara cuando se completa una orden.

**Acciones:**
- Busca la orden por `external_order_id`
- Actualiza el status a "completed" y payment_status a "paid"

## Estructura del Payload

```json
{
  "event": "order.created",
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "partner_id": "uuid",
    "customer_id": "uuid",
    "status": "pending",
    "total_amount": 5000,
    "items": [
      {
        "product_id": "uuid",
        "quantity": 2,
        "price": 2500
      }
    ],
    "payment_method": "mercadopago",
    "payment_status": "pending",
    "created_at": "2025-10-17T10:00:00Z",
    "updated_at": "2025-10-17T10:00:00Z"
  },
  "timestamp": "2025-10-17T10:00:00Z"
}
```

## Mapeo de Datos

### Cliente
- Si el cliente existe (basado en `customer_id`), se usa el existente
- Si no existe, se crea un nuevo cliente con:
  - `external_id`: customer_id de DogCatify
  - `company_name`: "Cliente DogCatify {customer_id_corto}"
  - `status`: "active"
  - `source`: "dogcatify"

### Orden
- `order_number`: Generado automáticamente como "DC-{timestamp}-{order_id_corto}"
- `client_id`: ID del cliente encontrado o creado
- `status`: Mapeado desde data.status
- `total_amount`: data.total_amount
- `payment_method`: data.payment_method
- `payment_status`: data.payment_status
- `external_order_id`: data.id (para tracking)
- `external_partner_id`: data.partner_id
- `metadata`: Todo el payload data (para referencia completa)

### Items de la Orden
- `product_name`: item.product_id (por ahora)
- `quantity`: item.quantity
- `unit_price`: item.price
- `total_price`: item.quantity * item.price
- `external_product_id`: item.product_id

## Identificación en el CRM

Las órdenes provenientes de DogCatify se identifican por:

1. **Badge "DogCatify"** en la lista de órdenes (color azul)
2. **Sección especial** en los detalles de la orden con:
   - ID de Orden Externa
   - ID de Partner
   - Método de Pago
   - Datos adicionales completos en formato JSON

## Testing del Webhook

Para probar el webhook, puedes usar curl:

```bash
curl -X POST https://satzkpynnuloncwgxeev.supabase.co/functions/v1/dogcatify-order-webhook \\
  -H "Content-Type: application/json" \\
  -H "X-Dogcatify-Signature: tu_firma_hmac" \\
  -d '{
    "event": "order.created",
    "order_id": "test-123",
    "data": {
      "id": "test-123",
      "partner_id": "partner-456",
      "customer_id": "customer-789",
      "status": "pending",
      "total_amount": 1000,
      "items": [
        {
          "product_id": "prod-001",
          "quantity": 1,
          "price": 1000
        }
      ],
      "payment_method": "mercadopago",
      "payment_status": "pending",
      "created_at": "2025-10-17T10:00:00Z",
      "updated_at": "2025-10-17T10:00:00Z"
    },
    "timestamp": "2025-10-17T10:00:00Z"
  }'
```

## Logs y Debugging

Para ver los logs del webhook:

1. Ve al Dashboard de Supabase
2. Navega a Edge Functions > dogcatify-order-webhook
3. Revisa los logs en la pestaña "Logs"

Los logs incluyen:
- Evento recibido
- Order ID
- Verificación de firma (si está configurada)
- Resultado de la creación/actualización de orden
- Errores detallados

## Base de Datos

### Tablas Modificadas

#### `clients`
Nuevos campos:
- `external_id`: ID del cliente en sistemas externos
- `source`: Origen del cliente (manual, dogcatify, etc)

#### `orders`
Nuevos campos:
- `external_order_id`: ID de la orden en DogCatify
- `external_partner_id`: ID del partner en DogCatify
- `payment_method`: Método de pago usado
- `metadata`: Datos completos del webhook en formato JSONB

#### `order_items`
Nuevos campos:
- `product_name`: Nombre del producto
- `external_product_id`: ID del producto en DogCatify
- `total_price`: Precio total de la línea

### Migración Requerida

Antes de usar el webhook, debes aplicar la migración:

```sql
-- Ubicada en: supabase/migrations/20251017000000_add_dogcatify_fields_to_orders.sql
```

## Seguridad

- El webhook NO requiere autenticación JWT (verify_jwt: false)
- La verificación de seguridad se hace mediante firma HMAC SHA-256
- Solo las peticiones con firma válida son procesadas (si DOGCATIFY_WEBHOOK_SECRET está configurado)
- Si no hay secret configurado, el webhook acepta todas las peticiones

## Próximos Pasos

1. **Registrar el webhook en DogCatify** con la URL proporcionada
2. **Configurar el secret** si DogCatify lo proporciona
3. **Aplicar la migración** de base de datos
4. **Probar** con órdenes de prueba
5. **Monitorear logs** para asegurar que todo funciona correctamente
