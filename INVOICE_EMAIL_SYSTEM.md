# Sistema de Envío Automático de Facturas

## Resumen

Sistema completo para enviar facturas por email cuando son validadas, incluyendo PDF adjunto con formato profesional.

## Flujo de Trabajo

1. **Creación de Factura**: El usuario crea una factura con estado "Borrador" (draft)
2. **Validación**: Cuando la factura está lista, se cambia el estado a "Validada" (validated)
3. **Envío Automático**: Al cambiar a "validated", se dispara automáticamente:
   - Trigger de base de datos detecta el cambio
   - Edge function genera y envía el email con PDF adjunto
   - Estado cambia automáticamente a "Enviada" (sent)

## Componentes

### 1. Base de Datos

#### Estados de Factura
- `draft`: Borrador inicial
- `validated`: Validada y lista para enviar (dispara email automático)
- `sent`: Enviada al cliente
- `paid`: Pagada
- `overdue`: Vencida
- `cancelled`: Cancelada

#### Trigger
- Detecta cuando `status` cambia a `validated`
- Llama al edge function automáticamente

### 2. Edge Function: send-invoice-email

**Ubicación**: `/supabase/functions/send-invoice-email/`

**Funcionalidad**:
- Recibe `invoice_id` como parámetro
- Obtiene datos de factura, cliente, orden e ítems
- Genera PDF HTML con formato profesional
- Genera email HTML con información resumida
- Envía email con PDF adjunto vía SMTP
- Actualiza estado a "sent"

**Plantillas**:

#### PDF de Factura
Incluye:
- Encabezado con logo y datos de empresa
- Información del cliente
- Detalle de ítems (descripción, cantidad, precio, descuento, IVA)
- Subtotales y total
- Términos y condiciones
- Notas adicionales

#### Cuerpo del Email
- Mensaje profesional
- Resumen de la factura
- Fecha de vencimiento
- PDF adjunto

### 3. Módulo de Facturas

**Cambios realizados**:
- Agregado estado "Validada" al selector
- Color cyan para estado validado
- Al seleccionar "Validada", se dispara automáticamente el envío

## Configuración Requerida

### 1. Configuración SMTP
En `system_settings` debe existir:
```json
{
  "setting_key": "smtp_config",
  "setting_value": {
    "host": "smtp.gmail.com",
    "port": 587,
    "username": "tu-email@gmail.com",
    "password": "tu-password-o-app-password"
  }
}
```

### 2. Información de la Empresa (Opcional)
En `system_settings` puede existir:
```json
{
  "setting_key": "company_info",
  "setting_value": {
    "name": "Mi Empresa S.A.",
    "rut": "123456789",
    "address": "Av. Principal 1234",
    "city": "Montevideo",
    "country": "Uruguay",
    "phone": "+598 2 1234567",
    "email": "contacto@miempresa.com",
    "web": "www.miempresa.com"
  }
}
```

Si no existe, usa valores por defecto.

## Uso

1. Crear o editar una factura
2. Completar todos los campos requeridos:
   - Cliente con email válido
   - Ítems de la factura
   - Fechas de emisión y vencimiento
3. Cambiar estado a "Validada"
4. El sistema automáticamente:
   - Genera el PDF
   - Envía el email
   - Cambia estado a "Enviada"

## Variables en las Plantillas

Las plantillas usan las siguientes variables del sistema:

### De la Factura
- `invoice_number`: Número de factura
- `issue_date`: Fecha de emisión
- `due_date`: Fecha de vencimiento
- `subtotal`: Subtotal
- `tax_amount`: Monto de IVA
- `discount_amount`: Descuentos
- `total_amount`: Total
- `notes`: Notas adicionales
- `terms`: Términos y condiciones

### Del Cliente
- `contact_name`: Nombre del contacto
- `company_name`: Nombre de la empresa
- `email`: Email
- `phone`: Teléfono
- `address`: Dirección
- `city`: Ciudad
- `country`: País

### De la Orden (si existe)
- `order_number`: Número de orden
- `currency`: Moneda (USD, UYU, etc.)
- `payment_method`: Método de pago
- `payment_terms`: Términos de pago

### Ítems
Cada ítem incluye:
- `description`: Descripción
- `quantity`: Cantidad
- `unit_price`: Precio unitario
- `discount`: Porcentaje de descuento
- `tax_rate`: Tasa de IVA
- `subtotal`: Subtotal del ítem

## Notas Técnicas

- El PDF se genera en HTML y se convierte automáticamente
- El envío usa nodemailer con configuración SMTP
- El trigger usa PostgreSQL para detección automática
- Edge function tiene acceso a todas las variables de entorno de Supabase
- El sistema es compatible con autenticación externa

## Troubleshooting

### Email no se envía
1. Verificar configuración SMTP en `system_settings`
2. Revisar logs del edge function
3. Verificar que el cliente tenga email válido

### PDF vacío o mal formateado
1. Verificar que la factura tenga ítems
2. Verificar que todos los campos numéricos sean válidos
3. Revisar datos de la empresa en configuración

### Estado no cambia automáticamente
1. Verificar que el trigger esté activo
2. Revisar permisos de la función
3. Verificar conectividad con edge function
