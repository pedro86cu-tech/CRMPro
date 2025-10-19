# Actualización: Campos de Respuesta DGI

## Resumen

Se han agregado campos adicionales para capturar la respuesta completa de DGI según el formato oficial.

## Campos Agregados a la Tabla `invoices`

### Nuevos Campos DGI

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `dgi_estado` | text | Estado de validación | "aprobado", "rechazado", "pendiente" |
| `dgi_codigo_autorizacion` | text | Código de autorización completo | "DGI-M0F2W4XS-M7UCAXQY" |
| `dgi_mensaje` | text | Mensaje descriptivo de DGI | "E-Factura validada y aprobada exitosamente" |
| `dgi_id_efactura` | text | ID único de eFactura | "uuid-de-la-factura" |
| `dgi_fecha_validacion` | timestamptz | Fecha/hora de validación DGI | "2025-10-19T23:30:45.123Z" |

## Formato de Respuesta DGI Soportado

```json
{
  "success": true,
  "estado": "aprobado",
  "codigo_autorizacion": "DGI-M0F2W4XS-M7UCAXQY",
  "numero_cfe": "101000001",
  "serie": "A",
  "fecha_validacion": "2025-10-19T23:30:45.123Z",
  "mensaje": "E-Factura validada y aprobada exitosamente por DGI",
  "id_efactura": "uuid-de-la-factura"
}
```

## Mapeo de Campos Actualizado

### Template DGI Uruguay (Actualizado)

**Response Mapping:**
```json
{
  "approved": "response.success",
  "dgi_estado": "response.estado",
  "dgi_codigo_autorizacion": "response.codigo_autorizacion",
  "numero_cfe": "response.numero_cfe",
  "serie_cfe": "response.serie",
  "dgi_fecha_validacion": "response.fecha_validacion",
  "dgi_mensaje": "response.mensaje",
  "dgi_id_efactura": "response.id_efactura"
}
```

## Campos Disponibles en la Interfaz

La interfaz visual de mapeo ahora incluye:

### Sección "Response" (15 campos totales)

**Campos DGI Específicos:**
1. **Estado DGI** (`dgi_estado`) - Estado de validación
2. **Código Autorización DGI** (`dgi_codigo_autorizacion`) - Código completo
3. **Mensaje DGI** (`dgi_mensaje`) - Mensaje descriptivo
4. **ID eFactura DGI** (`dgi_id_efactura`) - ID único
5. **Fecha Validación DGI** (`dgi_fecha_validacion`) - Fecha/hora oficial

**Campos CFE Originales:**
6. Número CFE
7. Serie CFE
8. Tipo CFE
9. CAE
10. Vencimiento CAE
11. Código QR

**Campos Genéricos:**
12. Aprobado (boolean)
13. Mensaje
14. Referencia
15. Fecha de Validación

## Funcionamiento Automático

### Cuando se valida una factura:

1. Sistema envía datos a DGI
2. DGI responde con formato completo:
```json
{
  "success": true,
  "estado": "aprobado",
  "codigo_autorizacion": "DGI-M0F2W4XS-M7UCAXQY",
  "numero_cfe": "101000001",
  "serie": "A",
  "fecha_validacion": "2025-10-19T23:30:45.123Z",
  "mensaje": "E-Factura validada exitosamente",
  "id_efactura": "abc-123-def"
}
```

3. Sistema actualiza automáticamente la factura:
```sql
UPDATE invoices SET
  dgi_estado = 'aprobado',
  dgi_codigo_autorizacion = 'DGI-M0F2W4XS-M7UCAXQY',
  numero_cfe = '101000001',
  serie_cfe = 'A',
  dgi_fecha_validacion = '2025-10-19T23:30:45.123Z',
  dgi_mensaje = 'E-Factura validada exitosamente',
  dgi_id_efactura = 'abc-123-def',
  status = 'validated',
  validated_at = NOW(),
  pending_validation = false
WHERE id = 'invoice-id';
```

## Consultas Útiles

### Ver todas las facturas validadas con datos DGI:

```sql
SELECT
  invoice_number,
  numero_cfe,
  dgi_estado,
  dgi_codigo_autorizacion,
  dgi_fecha_validacion,
  dgi_mensaje
FROM invoices
WHERE dgi_estado = 'aprobado'
ORDER BY dgi_fecha_validacion DESC;
```

### Ver facturas con código de autorización específico:

```sql
SELECT * FROM invoices
WHERE dgi_codigo_autorizacion = 'DGI-M0F2W4XS-M7UCAXQY';
```

### Ver facturas por estado DGI:

```sql
SELECT
  dgi_estado,
  COUNT(*) as cantidad,
  SUM(total_amount) as total_facturado
FROM invoices
WHERE dgi_estado IS NOT NULL
GROUP BY dgi_estado;
```

### Ver facturas validadas hoy:

```sql
SELECT * FROM invoices
WHERE DATE(dgi_fecha_validacion) = CURRENT_DATE
ORDER BY dgi_fecha_validacion DESC;
```

## Configuración para Usar los Nuevos Campos

### Opción 1: Usar Template Actualizado

1. Ir a **"Validación Ext."** → Editar configuración existente
2. Click en **"Cargar Template DGI Uruguay"**
3. El template se actualizará con los nuevos campos
4. Guardar

### Opción 2: Agregar Manualmente

En la sección **"Mapeo de Response"**, agregar:

| Campo API (Response) | Campo Local |
|---------------------|-------------|
| response.success | approved |
| response.estado | dgi_estado |
| response.codigo_autorizacion | dgi_codigo_autorizacion |
| response.numero_cfe | numero_cfe |
| response.serie | serie_cfe |
| response.fecha_validacion | dgi_fecha_validacion |
| response.mensaje | dgi_mensaje |
| response.id_efactura | dgi_id_efactura |

## Beneficios

✅ **Trazabilidad Completa**: Todos los datos de validación DGI almacenados

✅ **Auditoría**: Código de autorización y fecha oficial de DGI

✅ **Estados Claros**: Campo `dgi_estado` para filtrar facturas aprobadas/rechazadas

✅ **Mensajes Descriptivos**: Campo `dgi_mensaje` con respuesta oficial

✅ **ID Único**: Campo `dgi_id_efactura` para referencia cruzada con DGI

✅ **Búsquedas Optimizadas**: Índices en todos los campos nuevos

## Ejemplo de Uso Completo

```javascript
// 1. Frontend crea factura
const invoice = await createInvoice({
  client_id: 'abc-123',
  total_amount: 2420,
  status: 'draft'
});

// 2. Sistema detecta draft y marca para validación
// (Automático por trigger)

// 3. Sistema llama a validación DGI
await supabase.functions.invoke('validate-invoice-external', {
  body: { invoice_id: invoice.id }
});

// 4. Sistema recibe respuesta y actualiza factura
// (Automático por edge function)

// 5. Frontend consulta factura actualizada
const { data: validatedInvoice } = await supabase
  .from('invoices')
  .select('*')
  .eq('id', invoice.id)
  .single();

console.log(validatedInvoice);
/*
{
  invoice_number: "INV-2025-001",
  numero_cfe: "101000001",
  dgi_estado: "aprobado",
  dgi_codigo_autorizacion: "DGI-M0F2W4XS-M7UCAXQY",
  dgi_mensaje: "E-Factura validada exitosamente",
  dgi_id_efactura: "abc-123-def",
  dgi_fecha_validacion: "2025-10-19T23:30:45.123Z",
  status: "validated",
  validated_at: "2025-10-19T23:30:46.000Z"
}
*/
```

## Migración Aplicada

✅ Migración: `add_dgi_response_fields_to_invoices.sql`
- Agrega 5 nuevos campos
- Crea 3 índices
- Agrega comentarios de documentación

## Archivos Modificados

1. ✅ `supabase/migrations/add_dgi_response_fields_to_invoices.sql` - Nueva migración
2. ✅ `src/components/Settings/availableFields.ts` - Campos disponibles actualizados
3. ✅ `supabase/functions/validate-invoice-external/index.ts` - Mapeo de nuevos campos
4. ✅ Template DGI actualizado con mapeo de respuesta completo

## Retrocompatibilidad

✅ **100% Retrocompatible**: Los campos anteriores siguen funcionando
✅ **Campos Opcionales**: Los nuevos campos son `NULL` si no están mapeados
✅ **Configuraciones Existentes**: Siguen funcionando sin cambios

## Próximos Pasos Sugeridos

- [ ] Agregar validación de formato de `dgi_codigo_autorizacion`
- [ ] Dashboard con estadísticas por `dgi_estado`
- [ ] Alertas si `dgi_estado` = "rechazado"
- [ ] Reporte de facturas validadas por fecha
- [ ] Exportar datos para auditoría DGI
