// Campos disponibles del sistema para mapear en Request (enviar a API externa)
export const REQUEST_AVAILABLE_FIELDS = [
  // Información de la factura
  {
    value: 'invoice.invoice_number',
    label: 'Número de Factura',
    description: 'Número interno de factura'
  },
  {
    value: 'invoice.total_amount',
    label: 'Total',
    description: 'Monto total de la factura'
  },
  {
    value: 'invoice.subtotal',
    label: 'Subtotal',
    description: 'Subtotal sin impuestos'
  },
  {
    value: 'invoice.tax_amount',
    label: 'IVA',
    description: 'Monto de IVA'
  },
  {
    value: 'invoice.tax_rate',
    label: 'Tasa IVA',
    description: 'Porcentaje de IVA (ej: 22)'
  },
  {
    value: 'invoice.discount_amount',
    label: 'Descuentos',
    description: 'Monto de descuentos'
  },
  {
    value: 'invoice.currency',
    label: 'Moneda',
    description: 'Código de moneda (UYU, USD, etc)'
  },
  {
    value: 'invoice.issue_date',
    label: 'Fecha de Emisión',
    description: 'Fecha de emisión de la factura'
  },
  {
    value: 'invoice.due_date',
    label: 'Fecha de Vencimiento',
    description: 'Fecha de vencimiento de la factura'
  },
  {
    value: 'invoice.status',
    label: 'Estado',
    description: 'Estado actual de la factura'
  },
  {
    value: 'invoice.payment_terms',
    label: 'Términos de Pago',
    description: 'Términos de pago acordados'
  },
  {
    value: 'invoice.notes',
    label: 'Notas',
    description: 'Notas adicionales de la factura'
  },

  // Información del cliente
  {
    value: 'invoice.clients.contact_name',
    label: 'Nombre Cliente',
    description: 'Nombre de contacto del cliente'
  },
  {
    value: 'invoice.clients.company_name',
    label: 'Razón Social Cliente',
    description: 'Razón social del cliente'
  },
  {
    value: 'invoice.clients.email',
    label: 'Email Cliente',
    description: 'Email del cliente'
  },
  {
    value: 'invoice.clients.phone',
    label: 'Teléfono Cliente',
    description: 'Teléfono del cliente'
  },
  {
    value: 'invoice.clients.tax_id',
    label: 'RUT/NIT Cliente',
    description: 'Identificación fiscal del cliente'
  },
  {
    value: 'invoice.clients.address',
    label: 'Dirección Cliente',
    description: 'Dirección del cliente'
  },
  {
    value: 'invoice.clients.city',
    label: 'Ciudad Cliente',
    description: 'Ciudad del cliente'
  },
  {
    value: 'invoice.clients.country',
    label: 'País Cliente',
    description: 'País del cliente'
  },
  {
    value: 'invoice.clients.postal_code',
    label: 'Código Postal Cliente',
    description: 'Código postal del cliente'
  },

  // Información de la orden asociada
  {
    value: 'invoice.orders.order_number',
    label: 'Número de Orden',
    description: 'Número de orden asociada'
  },
  {
    value: 'invoice.orders.shipping_address',
    label: 'Dirección de Envío',
    description: 'Dirección de envío de la orden'
  },
  {
    value: 'invoice.orders.shipping_cost',
    label: 'Costo de Envío',
    description: 'Costo de envío'
  },
  {
    value: 'invoice.orders.payment_method',
    label: 'Método de Pago',
    description: 'Método de pago utilizado'
  },
];

// Campos que se pueden mapear desde la respuesta de la API
export const RESPONSE_AVAILABLE_FIELDS = [
  {
    value: 'numero_cfe',
    label: 'Número CFE',
    description: 'Número de Comprobante Fiscal Electrónico'
  },
  {
    value: 'serie_cfe',
    label: 'Serie CFE',
    description: 'Serie del comprobante'
  },
  {
    value: 'tipo_cfe',
    label: 'Tipo CFE',
    description: 'Tipo de comprobante (eFactura, eTicket, etc)'
  },
  {
    value: 'cae',
    label: 'CAE',
    description: 'Código de Autorización Electrónico'
  },
  {
    value: 'vencimiento_cae',
    label: 'Vencimiento CAE',
    description: 'Fecha de vencimiento del CAE'
  },
  {
    value: 'qr_code',
    label: 'Código QR',
    description: 'Datos para código QR'
  },
  {
    value: 'dgi_estado',
    label: 'Estado DGI',
    description: 'Estado de validación (aprobado, rechazado, pendiente)'
  },
  {
    value: 'dgi_codigo_autorizacion',
    label: 'Código Autorización DGI',
    description: 'Código de autorización completo de DGI'
  },
  {
    value: 'dgi_mensaje',
    label: 'Mensaje DGI',
    description: 'Mensaje descriptivo de la respuesta'
  },
  {
    value: 'dgi_id_efactura',
    label: 'ID eFactura DGI',
    description: 'ID único asignado por DGI'
  },
  {
    value: 'dgi_fecha_validacion',
    label: 'Fecha Validación DGI',
    description: 'Fecha/hora de validación según DGI'
  },
  {
    value: 'approved',
    label: 'Aprobado (boolean)',
    description: 'Si la factura fue aprobada (true/false)'
  },
  {
    value: 'message',
    label: 'Mensaje',
    description: 'Mensaje de respuesta'
  },
  {
    value: 'reference',
    label: 'Referencia',
    description: 'ID de referencia externa'
  },
  {
    value: 'validation_date',
    label: 'Fecha de Validación',
    description: 'Fecha de validación'
  },
];

// Template predefinido para DGI Uruguay
export const DGI_URUGUAY_TEMPLATE = {
  request: {
    'numero_cfe': '',
    'serie': '',
    'tipo_cfe': '',
    'rut_emisor': '',
    'razon_social_emisor': '',
    'rut_receptor': 'invoice.clients.tax_id',
    'razon_social_receptor': 'invoice.clients.company_name',
    'fecha_emision': 'invoice.issue_date',
    'moneda': 'invoice.currency',
    'total': 'invoice.total_amount',
    'subtotal': 'invoice.subtotal',
    'iva': 'invoice.tax_amount',
  },
  response: {
    'approved': 'response.success',
    'dgi_estado': 'response.estado',
    'dgi_codigo_autorizacion': 'response.codigo_autorizacion',
    'numero_cfe': 'response.numero_cfe',
    'serie_cfe': 'response.serie',
    'dgi_fecha_validacion': 'response.fecha_validacion',
    'dgi_mensaje': 'response.mensaje',
    'dgi_id_efactura': 'response.id_efactura',
  }
};
