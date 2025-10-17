# Guía para Probar el Webhook de DogCatify

## URL del Webhook
```
https://satzkpynnuloncwgxeev.supabase.co/functions/v1/dogcatify-order-webhook
```

## Cómo Funciona

1. **DogCatify** envía automáticamente notificaciones cuando ocurren eventos
2. El webhook **recibe** esos datos en el body del POST
3. El webhook **procesa** el evento y guarda los datos en el CRM

## Configuración en DogCatify

Debes registrar esta URL en el panel de DogCatify para que ellos envíen las notificaciones automáticamente.

---

## Prueba Manual del Webhook

### En Postman / Thunder Client / Insomnia

**Método:** POST

**URL:**
```
https://satzkpynnuloncwgxeev.supabase.co/functions/v1/dogcatify-order-webhook
```

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**

### Ejemplo 1: Crear Orden (order.created)

```json
{
  "success": true,
  "action": "order.created",
  "data": {
    "order": {
      "id": "order-test-001",
      "partner_id": "partner-456",
      "customer_id": "customer-789",
      "status": "pending",
      "total_amount": 250.50,
      "order_type": "product",
      "items": [
        {
          "product_id": "prod-collar-001",
          "quantity": 2,
          "price": 75.25
        },
        {
          "product_id": "prod-comida-002",
          "quantity": 1,
          "price": 100.00
        }
      ],
      "payment_method": "mercadopago",
      "payment_status": "pending",
      "created_at": "2025-10-17T12:00:00Z",
      "customer": {
        "id": "customer-789",
        "full_name": "María González",
        "email": "maria@example.com",
        "phone": "+54911234567",
        "address": "Av. Corrientes 1234",
        "city": "Buenos Aires",
        "country": "Argentina"
      }
    }
  }
}
```

**Resultado esperado:**
- Status: 200 OK
- Se crea un nuevo cliente en la tabla `clients`
- Se crea una nueva orden en la tabla `orders`
- Se crean los items en la tabla `order_items`

---

### Ejemplo 2: Actualizar Orden (order.updated)

```json
{
  "success": true,
  "action": "order.updated",
  "data": {
    "order": {
      "id": "order-test-001",
      "partner_id": "partner-456",
      "customer_id": "customer-789",
      "status": "processing",
      "total_amount": 250.50,
      "order_type": "product",
      "items": [
        {
          "product_id": "prod-collar-001",
          "quantity": 2,
          "price": 75.25
        }
      ],
      "payment_method": "mercadopago",
      "payment_status": "paid",
      "created_at": "2025-10-17T12:00:00Z",
      "updated_at": "2025-10-17T13:00:00Z"
    }
  }
}
```

**Resultado esperado:**
- Status: 200 OK
- Se actualiza el status y payment_status de la orden existente

---

### Ejemplo 3: Completar Orden (order.completed)

```json
{
  "success": true,
  "action": "order.completed",
  "data": {
    "order": {
      "id": "order-test-001",
      "partner_id": "partner-456",
      "customer_id": "customer-789",
      "status": "completed",
      "total_amount": 250.50,
      "order_type": "product",
      "items": [],
      "payment_method": "mercadopago",
      "payment_status": "paid",
      "created_at": "2025-10-17T12:00:00Z",
      "updated_at": "2025-10-17T14:00:00Z"
    }
  }
}
```

**Resultado esperado:**
- Status: 200 OK
- La orden cambia a status "completed" y payment_status "paid"

---

### Ejemplo 4: Cancelar Orden (order.cancelled)

```json
{
  "success": true,
  "action": "order.cancelled",
  "data": {
    "order": {
      "id": "order-test-001",
      "partner_id": "partner-456",
      "customer_id": "customer-789",
      "status": "cancelled",
      "total_amount": 250.50,
      "order_type": "product",
      "items": [],
      "payment_method": "mercadopago",
      "payment_status": "refunded",
      "created_at": "2025-10-17T12:00:00Z",
      "updated_at": "2025-10-17T15:00:00Z"
    }
  }
}
```

**Resultado esperado:**
- Status: 200 OK
- La orden cambia a status "cancelled"

---

## Usando cURL

```bash
curl -X POST https://satzkpynnuloncwgxeev.supabase.co/functions/v1/dogcatify-order-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "success": true,
    "action": "order.created",
    "data": {
      "order": {
        "id": "order-test-curl",
        "partner_id": "partner-456",
        "customer_id": "customer-curl-test",
        "status": "pending",
        "total_amount": 150.00,
        "order_type": "product",
        "items": [
          {
            "product_id": "prod-test-001",
            "quantity": 1,
            "price": 150.00
          }
        ],
        "payment_method": "mercadopago",
        "payment_status": "pending",
        "created_at": "2025-10-17T12:00:00Z",
        "customer": {
          "id": "customer-curl-test",
          "full_name": "Test User",
          "email": "test@example.com",
          "phone": "+1234567890",
          "address": "Test Address 123",
          "city": "Test City",
          "country": "Test Country"
        }
      }
    }
  }'
```

---

## Verificar que Funcionó

1. **Ver los logs:**
   - Ve a: https://supabase.com/dashboard/project/satzkpynnuloncwgxeev/functions/dogcatify-order-webhook/logs
   - Verás los console.log con los datos procesados

2. **Ver los datos en la base de datos:**
   - Ve a la tabla `clients` y busca el cliente creado
   - Ve a la tabla `orders` y busca la orden creada
   - Ve a la tabla `order_items` y busca los items

---

## Errores Comunes

### Error: "Method not allowed"
- **Causa:** Estás usando GET en lugar de POST
- **Solución:** Cambia el método a POST

### Error: "Invalid content type"
- **Causa:** Falta el header Content-Type
- **Solución:** Agrega el header `Content-Type: application/json`

### Error: "Invalid JSON"
- **Causa:** El body no tiene un JSON válido o está vacío
- **Solución:** Selecciona "raw" y pega uno de los ejemplos de JSON de arriba

---

## Cuando DogCatify Envíe Notificaciones Reales

Una vez registrada la URL en DogCatify:

1. Cuando se cree una orden en DogCatify → envía `order.created`
2. Cuando se actualice una orden → envía `order.updated`
3. Cuando se complete una orden → envía `order.completed`
4. Cuando se cancele una orden → envía `order.cancelled`

**No necesitas hacer nada más**, el webhook procesará automáticamente cada evento.
