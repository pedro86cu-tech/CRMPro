# Sistema de Envío Automático de Facturas por Email

## Resumen

Se ha implementado un sistema completo que envía automáticamente las facturas por email cuando son aprobadas por DGI.

## Componentes del Sistema

### 1. Tabla de Cola de Emails (`invoice_email_queue`)

Tabla que almacena las facturas pendientes de envío por email.

**Campos:**
- `id` - UUID único
- `invoice_id` - Referencia a la factura
- `status` - Estado: pending, processing, sent, failed
- `priority` - Prioridad (mayor número = más prioritario)
- `attempts` - Número de intentos de envío
- `last_error` - Último error registrado
- `created_at` - Fecha de creación
- `processed_at` - Fecha de procesamiento

### 2. Trigger Automático (`trigger_queue_invoice_email_on_dgi_approval`)

**Cuándo se ejecuta:**
- Al insertar una factura nueva
- Al actualizar el campo `dgi_estado` de una factura

**Qué hace:**
- Detecta cuando `dgi_estado` cambia a 'aprobado'
- Verifica que no esté ya en la cola
- Agrega la factura a la cola con prioridad alta (10)

**Código SQL:**
```sql
CREATE TRIGGER trigger_queue_invoice_email_on_dgi_approval
  AFTER INSERT OR UPDATE OF dgi_estado ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION queue_invoice_email_on_dgi_approval();
```

### 3. Procesador de Cola (Frontend)

**Ubicación:** `InvoicesModule.tsx`

**Funcionamiento:**
- Se ejecuta cada 10 segundos
- Procesa hasta 5 emails pendientes por ciclo
- Marca como 'processing' antes de enviar
- Llama a la edge function `send-invoice-email`
- Actualiza estado a 'sent' o 'failed'

**Código:**
```typescript
useEffect(() => {
  processEmailQueue();

  const interval = setInterval(() => {
    processEmailQueue();
  }, 10000); // Cada 10 segundos

  return () => clearInterval(interval);
}, []);
```

### 4. Interfaz Actualizada

**Columnas de la tabla de facturas:**
- **Número / CFE**: Muestra CFE si existe, sino número interno
- **Cliente**: Con ícono y orden asociada
- **Monto**: En formato moneda
- **Emisión**: Fecha + Tipo CFE
- **Estado**: Estado + Badge DGI (aprobado/rechazado/pendiente)
- **Acciones**: Ver, Editar, Eliminar, Descargar

**Visualización CFE:**
```tsx
{invoice.numero_cfe ? (
  <>
    <p className="font-bold text-blue-600">CFE: {invoice.numero_cfe}</p>
    {invoice.serie_cfe && <p className="text-xs">Serie: {invoice.serie_cfe}</p>}
    <p className="text-xs text-slate-400">{invoice.invoice_number}</p>
  </>
) : (
  <span>{invoice.invoice_number}</span>
)}
```

**Badge Estado DGI:**
```tsx
{invoice.dgi_estado && (
  <span className={
    invoice.dgi_estado === 'aprobado'
      ? 'bg-green-100 text-green-700'
      : 'bg-red-100 text-red-700'
  }>
    DGI: {invoice.dgi_estado}
  </span>
)}
```

## Flujo Completo del Sistema

### Escenario 1: Orden desde DogCatify

```
1. Usuario completa compra en DogCatify
   ↓
2. Webhook crea orden en CRM
   ↓
3. Sistema crea factura automáticamente (status: draft)
   ↓
4. Trigger marca pending_validation = true
   ↓
5. Edge function validate-invoice-external envía a DGI
   ↓
6. DGI responde con aprobación:
   {
     "success": true,
     "estado": "aprobado",
     "numero_cfe": "101000001",
     "codigo_autorizacion": "DGI-M0F2W4XS-M7UCAXQY"
   }
   ↓
7. Edge function actualiza factura:
   - numero_cfe = "101000001"
   - dgi_estado = "aprobado"
   - dgi_codigo_autorizacion = "DGI-M0F2W4XS-M7UCAXQY"
   - status = "validated"
   ↓
8. Trigger detecta dgi_estado = 'aprobado'
   ↓
9. Agrega factura a invoice_email_queue (priority: 10)
   ↓
10. Procesador frontend (cada 10 seg) detecta cola
   ↓
11. Llama a send-invoice-email
   ↓
12. PDF se genera con datos oficiales de DGI:
    - Número CFE en lugar de número interno
    - CAE y código de autorización
    - Serie y Tipo CFE
   ↓
13. Email se envía al cliente con PDF oficial
   ↓
14. Cola se marca como 'sent'
   ↓
15. Toast notifica: "Factura enviada por email automáticamente"
```

### Escenario 2: Factura Manual

```
1. Usuario crea factura manualmente
   ↓
2. Usuario marca factura como "draft"
   ↓
3-15. [Mismo flujo que arriba desde paso 4]
```

## Monitoreo del Sistema

### Ver cola de emails pendientes

```sql
SELECT
  q.id,
  q.invoice_id,
  i.invoice_number,
  i.numero_cfe,
  q.status,
  q.priority,
  q.attempts,
  q.created_at
FROM invoice_email_queue q
JOIN invoices i ON i.id = q.invoice_id
WHERE q.status = 'pending'
ORDER BY q.priority DESC, q.created_at ASC;
```

### Ver emails enviados hoy

```sql
SELECT
  q.id,
  i.invoice_number,
  i.numero_cfe,
  i.clients.email,
  q.processed_at
FROM invoice_email_queue q
JOIN invoices i ON i.id = q.invoice_id
WHERE q.status = 'sent'
AND DATE(q.processed_at) = CURRENT_DATE
ORDER BY q.processed_at DESC;
```

### Ver emails fallidos

```sql
SELECT
  q.id,
  i.invoice_number,
  q.attempts,
  q.last_error,
  q.created_at
FROM invoice_email_queue q
JOIN invoices i ON i.id = q.invoice_id
WHERE q.status = 'failed'
ORDER BY q.created_at DESC;
```

### Estadísticas de la cola

```sql
SELECT
  status,
  COUNT(*) as cantidad,
  AVG(attempts) as promedio_intentos
FROM invoice_email_queue
GROUP BY status;
```

## Configuración

### Cambiar frecuencia de procesamiento

En `InvoicesModule.tsx`, línea ~166:

```typescript
const interval = setInterval(() => {
  processEmailQueue();
}, 10000); // Cambiar este valor (en milisegundos)
```

**Opciones recomendadas:**
- 5000 = 5 segundos (más rápido, más carga)
- 10000 = 10 segundos (recomendado)
- 30000 = 30 segundos (más lento)

### Cambiar cantidad de emails por ciclo

En `InvoicesModule.tsx`, función `processEmailQueue`:

```typescript
.limit(5); // Cambiar este valor
```

### Cambiar prioridad de emails automáticos

En migración, función `queue_invoice_email_on_dgi_approval`:

```sql
INSERT INTO invoice_email_queue (invoice_id, priority, status)
VALUES (NEW.id, 10, 'pending'); -- Cambiar priority aquí
```

**Escala de prioridades:**
- 1-5: Baja prioridad
- 6-10: Prioridad normal
- 11-20: Alta prioridad

## Reintentos Automáticos

El sistema NO reintenta automáticamente emails fallidos. Para implementar reintentos:

### Opción 1: Reprocesar manualmente

```sql
UPDATE invoice_email_queue
SET status = 'pending',
    attempts = attempts + 1
WHERE status = 'failed'
AND attempts < 3;
```

### Opción 2: Agregar lógica de reintentos

Modificar `processEmailQueue` para incluir:

```typescript
const { data: queueItems } = await supabase
  .from('invoice_email_queue')
  .select('id, invoice_id, attempts')
  .in('status', ['pending', 'failed'])
  .lt('attempts', 3) // Máximo 3 intentos
  .order('priority', { ascending: false });
```

## Solución de Problemas

### Email no se envía

1. **Verificar que la factura está en la cola:**
```sql
SELECT * FROM invoice_email_queue
WHERE invoice_id = 'factura-id';
```

2. **Verificar estado DGI:**
```sql
SELECT dgi_estado FROM invoices
WHERE id = 'factura-id';
```

3. **Verificar logs de edge function:**
Ver logs en Supabase Dashboard → Edge Functions → send-invoice-email

### Email se marca como fallido

1. **Ver el error:**
```sql
SELECT last_error FROM invoice_email_queue
WHERE invoice_id = 'factura-id';
```

2. **Errores comunes:**
- "Email configuration not found" → Configurar SMTP en general_settings
- "Invalid email address" → Verificar email del cliente
- "PDF generation failed" → Verificar datos de factura

### Procesador no ejecuta

1. **Verificar que InvoicesModule está montado:**
   - El procesador solo funciona cuando el usuario está en la pantalla de facturas

2. **Solución:**
   - Mover el procesador a un contexto global
   - O usar un cron job/webhook externo

## Mejoras Futuras

- [ ] Procesador en background (worker/cron)
- [ ] Dashboard de métricas de la cola
- [ ] Notificaciones si cola tiene más de X items
- [ ] Reintentos automáticos con backoff exponencial
- [ ] Limpieza automática de items antiguos 'sent'
- [ ] Prioridad basada en cliente VIP
- [ ] Logs detallados de cada intento de envío

## Seguridad

✅ **RLS Habilitado** en invoice_email_queue
✅ **Solo authenticated** puede leer/escribir
✅ **Triggers seguros** no exponen datos sensibles
✅ **Emails desde servidor** (edge function)
✅ **No se exponen credenciales SMTP** al frontend

## Mantenimiento

### Limpiar cola antigua (ejecutar mensualmente)

```sql
DELETE FROM invoice_email_queue
WHERE status = 'sent'
AND processed_at < NOW() - INTERVAL '30 days';
```

### Resetear intentos fallidos

```sql
UPDATE invoice_email_queue
SET status = 'pending',
    attempts = 0,
    last_error = NULL
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '7 days';
```

## Resumen de Archivos

**Migraciones:**
- `create_auto_send_invoice_on_dgi_approval.sql` - Tabla y trigger

**Frontend:**
- `src/components/Invoices/InvoicesModule.tsx` - Procesador de cola y UI actualizada

**Edge Functions:**
- `send-invoice-email/index.ts` - Generación y envío de PDF (ya existente)

**Documentación:**
- `AUTO_INVOICE_EMAIL_SYSTEM.md` - Este documento
- `DGI_INTEGRATION_GUIDE.md` - Guía de integración DGI
