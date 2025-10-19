import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Dogcatify-Signature",
};

interface DogCatifyCustomer {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  calle: string;
  numero: string;
  barrio: string;
  codigo_postal: string;
  location?: any;
}

interface DogCatifyItem {
  id: string;
  name: string;
  image?: string;
  price: number;
  currency: string;
  quantity: number;
  partnerId: string;
  partnerName: string;
  iva_rate?: number;
  iva_amount?: number;
  subtotal?: number;
  original_price?: number;
  discount_percentage?: number;
  currency_code_dgi?: string;
}

interface DogCatifyOrder {
  id: string;
  partner_id: string;
  customer_id: string;
  status: string;
  payment_status: string | null;
  payment_method: string;
  total_amount: number;
  partner_amount: number;
  commission_amount: number;
  order_type: string;
  shipping_address: string;
  created_at: string;
  updated_at: string;
  customer: DogCatifyCustomer;
  items: DogCatifyItem[];
  pet_id?: string | null;
  booking_id?: string | null;
  service_id?: string | null;
  payment_id?: string | null;
  payment_preference_id?: string | null;
  booking_notes?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  iva_rate?: number;
  iva_amount?: number;
  subtotal?: number;
}

interface WebhookPayload {
  event: string;
  order_id: string;
  timestamp: string;
  data: DogCatifyOrder;
}

async function verifySignature(payload: any, signature: string): Promise<boolean> {
  const webhookSecret = Deno.env.get("DOGCATIFY_WEBHOOK_SECRET");
  
  if (!webhookSecret) {
    console.error("DOGCATIFY_WEBHOOK_SECRET no está configurado");
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const key = encoder.encode(webhookSecret);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const expected = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return signature === expected;
  } catch (error) {
    console.error("Error verificando firma:", error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
        message: "Este endpoint solo acepta peticiones POST con un JSON válido en el body"
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    console.log("=== WEBHOOK DOGCATIFY RECIBIDO ===");
    console.log("Método:", req.method);

    const signature = req.headers.get("x-dogcatify-signature");

    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return new Response(
        JSON.stringify({
          error: "Invalid content type",
          message: "El Content-Type debe ser application/json"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let rawPayload;
    try {
      rawPayload = await req.json();
    } catch (jsonError) {
      console.error("Error parseando JSON:", jsonError);
      return new Response(
        JSON.stringify({
          error: "Invalid JSON",
          message: "El body de la petición no es un JSON válido"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Payload recibido:", JSON.stringify(rawPayload, null, 2));

    const payload: WebhookPayload = rawPayload;
    const event = payload.event;
    const orderData = payload.data;

    console.log("Evento:", event);
    console.log("Order ID:", payload.order_id);
    console.log("Order Data:", JSON.stringify(orderData, null, 2));

    if (signature && Deno.env.get("DOGCATIFY_WEBHOOK_SECRET")) {
      const isValid = await verifySignature(payload, signature);
      if (!isValid) {
        console.error("Firma inválida");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      console.log("✓ Firma verificada correctamente");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (event) {
      case "order.created": {
        console.log("Procesando nueva orden...");

        const customerData = orderData.customer;
        let clientId = null;

        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("external_id", orderData.customer_id)
          .maybeSingle();

        if (existingClient) {
          clientId = existingClient.id;
          console.log("✓ Cliente existente encontrado:", clientId);

          const fullAddress = `${customerData.calle} ${customerData.numero}, ${customerData.barrio}`;
          const { error: updateError } = await supabase
            .from("clients")
            .update({
              contact_name: customerData.display_name,
              email: customerData.email,
              phone: customerData.phone,
              address: fullAddress,
              city: customerData.barrio,
              country: "Uruguay",
              updated_at: new Date().toISOString()
            })
            .eq("id", clientId);

          if (!updateError) {
            console.log("✓ Datos del cliente actualizados");
          }
        } else {
          const fullAddress = `${customerData.calle} ${customerData.numero}, ${customerData.barrio}`;

          const clientInsertData: any = {
            external_id: orderData.customer_id,
            contact_name: customerData.display_name,
            company_name: customerData.display_name,
            email: customerData.email,
            phone: customerData.phone,
            address: fullAddress,
            city: customerData.barrio,
            country: "Uruguay",
            status: "active",
            source: "dogcatify"
          };

          const { data: newClient, error: clientError } = await supabase
            .from("clients")
            .insert(clientInsertData)
            .select("id")
            .single();

          if (clientError) {
            console.error("Error creando cliente:", clientError);
            throw clientError;
          }

          clientId = newClient.id;
          console.log("✓ Cliente creado:", clientId);
        }

        const orderNumber = `DC-${Date.now()}-${orderData.id.substring(0, 8)}`;

        const subtotal = orderData.subtotal || (orderData.total_amount - orderData.commission_amount);
        const taxRate = orderData.iva_rate || 0;
        const taxAmount = orderData.iva_amount || 0;
        const shippingAddress = `${orderData.shipping_address || customerData.calle + ' ' + customerData.numero}`;

        const orderCurrency = orderData.items && orderData.items.length > 0 ? orderData.items[0].currency : 'UYU';
        console.log("Moneda de la orden:", orderCurrency);

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            order_number: orderNumber,
            client_id: clientId,
            status: orderData.status || 'pending',
            payment_status: orderData.payment_status || 'unpaid',
            payment_method: orderData.payment_method || 'unknown',
            total_amount: orderData.total_amount,
            subtotal: subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            discount_amount: 0,
            shipping_cost: 0,
            shipping_address: shippingAddress,
            billing_address: shippingAddress,
            currency: orderCurrency,
            external_order_id: orderData.id,
            external_partner_id: orderData.partner_id,
            notes: `Orden importada desde DogCatify (${orderData.items[0]?.partnerName || 'Partner'})\nTipo: ${orderData.order_type}\nMétodo de pago: ${orderData.payment_method}\nMonto partner: ${orderData.partner_amount}\nComisión: ${orderData.commission_amount}`,
            metadata: orderData,
            order_date: new Date(orderData.created_at).toISOString().split('T')[0]
          })
          .select()
          .single();

        if (orderError) {
          console.error("Error creando orden:", orderError);
          throw orderError;
        }

        console.log("✓ Orden creada:", order.id);

        if (orderData.items && orderData.items.length > 0) {
          const orderItems = orderData.items.map((item) => ({
            order_id: order.id,
            product_name: item.name,
            description: `${item.name} - ${item.partnerName}`,
            quantity: item.quantity,
            unit_price: item.price,
            line_total: item.quantity * item.price,
            total_price: item.quantity * item.price,
            discount_percent: item.discount_percentage || 0,
            external_product_id: item.id,
            item_type: 'product',
            currency: item.currency || 'UYU',
            notes: item.image ? `Imagen: ${item.image}` : ''
          }));

          const { error: itemsError } = await supabase
            .from("order_items")
            .insert(orderItems);

          if (itemsError) {
            console.error("Error creando items:", itemsError);
          } else {
            console.log(`✓ ${orderItems.length} items creados`);
          }
        }
        
        break;
      }

      case "order.update":
      case "order.updated": {
        console.log("Procesando actualización de orden...");

        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("external_order_id", orderData.id)
          .maybeSingle();

        if (existingOrder) {
          const updateData: any = {
            metadata: orderData,
            updated_at: new Date().toISOString()
          };

          if (orderData.status) {
            const orderStatusMap: Record<string, string> = {
              'pending': 'pending',
              'confirmed': 'confirmed',
              'in_progress': 'in_progress',
              'processing': 'processing',
              'shipped': 'shipped',
              'delivered': 'delivered',
              'completed': 'completed',
              'cancelled': 'cancelled',
              'approved': 'confirmed',
              'active': 'in_progress'
            };

            const mappedOrderStatus = orderStatusMap[orderData.status.toLowerCase()] || 'pending';
            updateData.status = mappedOrderStatus;
            console.log(`Order status mapeado: ${orderData.status} -> ${mappedOrderStatus}`);
          }

          if (orderData.payment_status) {
            const paymentStatusMap: Record<string, string> = {
              'confirmed': 'paid',
              'paid': 'paid',
              'unpaid': 'unpaid',
              'pending': 'pending',
              'processing': 'processing',
              'partial': 'partial',
              'refunded': 'refunded',
              'cancelled': 'cancelled',
              'approved': 'paid',
              'completed': 'paid',
              'failed': 'cancelled'
            };

            const mappedPaymentStatus = paymentStatusMap[orderData.payment_status.toLowerCase()] || orderData.payment_status;
            updateData.payment_status = mappedPaymentStatus;
            console.log(`Payment status mapeado: ${orderData.payment_status} -> ${mappedPaymentStatus}`);

            if (mappedPaymentStatus === 'paid') {
              updateData.status = 'confirmed';
              console.log('✓ Pago confirmado - Status de orden actualizado a "confirmed"');
            }
          }

          if (orderData.total_amount !== undefined) {
            updateData.total_amount = orderData.total_amount;
          }
          if (orderData.payment_method) {
            updateData.payment_method = orderData.payment_method;
          }

          const { error: updateError } = await supabase
            .from("orders")
            .update(updateData)
            .eq("id", existingOrder.id);

          if (updateError) {
            console.error("Error actualizando orden:", updateError);
            throw updateError;
          }

          console.log("✓ Orden actualizada:", existingOrder.id);
          console.log("Campos actualizados:", updateData);
        } else {
          console.warn("Orden no encontrada para actualizar:", orderData.id);
        }

        break;
      }

      case "order.cancelled": {
        console.log("Procesando cancelación de orden...");

        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("external_order_id", orderData.id)
          .maybeSingle();

        if (existingOrder) {
          const { error: cancelError } = await supabase
            .from("orders")
            .update({
              status: "cancelled",
              metadata: orderData,
              updated_at: new Date().toISOString()
            })
            .eq("id", existingOrder.id);

          if (cancelError) {
            console.error("Error cancelando orden:", cancelError);
            throw cancelError;
          }

          console.log("✓ Orden cancelada:", existingOrder.id);
        }
        
        break;
      }

      case "order.completed": {
        console.log("Procesando completación de orden...");

        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("external_order_id", orderData.id)
          .maybeSingle();

        if (existingOrder) {
          const { error: completeError } = await supabase
            .from("orders")
            .update({
              status: "completed",
              payment_status: "paid",
              metadata: orderData,
              updated_at: new Date().toISOString()
            })
            .eq("id", existingOrder.id);

          if (completeError) {
            console.error("Error completando orden:", completeError);
            throw completeError;
          }

          console.log("✓ Orden completada:", existingOrder.id);
        }
        
        break;
      }

      default:
        console.warn("Evento no manejado:", event);
    }

    return new Response(
      JSON.stringify({
        received: true,
        success: true,
        order_id: payload.order_id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
    
  } catch (error: any) {
    console.error("Error procesando webhook:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});