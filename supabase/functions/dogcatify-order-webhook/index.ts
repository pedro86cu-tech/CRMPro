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

interface ShippingInfo {
  shipping_cost: number;
  shipping_total: number;
  shipping_address: string;
  shipping_iva_amount: number;
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
  shipping_cost?: number;
  shipping_info?: ShippingInfo | null;
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
    console.error("DOGCATIFY_WEBHOOK_SECRET no est\u00e1 configurado");
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
        message: "Este endpoint solo acepta peticiones POST con un JSON v\u00e1lido en el body"
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    console.log("=== WEBHOOK DOGCATIFY RECIBIDO ===");
    console.log("M\u00e9todo:", req.method);

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
          message: "El body de la petici\u00f3n no es un JSON v\u00e1lido"
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
        console.error("Firma inv\u00e1lida");
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      console.log("\u2713 Firma verificada correctamente");
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
          console.log("\u2713 Cliente existente encontrado:", clientId);

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
            console.log("\u2713 Datos del cliente actualizados");
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
          console.log("\u2713 Cliente creado:", clientId);
        }

        const orderNumber = `DC-${Date.now()}-${orderData.id.substring(0, 8)}`;

        let subtotal = orderData.subtotal || 0;
        let taxRate = orderData.iva_rate || 0;
        let taxAmount = orderData.iva_amount || 0;
        let totalAmount = orderData.total_amount || 0;
        let shippingCost = 0;
        let shippingTaxAmount = 0;

        if (orderData.shipping_info && orderData.shipping_info.shipping_cost) {
          shippingCost = orderData.shipping_info.shipping_cost || 0;
          shippingTaxAmount = orderData.shipping_info.shipping_iva_amount || 0;
          console.log(`Costo de env\u00edo detectado: $${shippingCost}, IVA env\u00edo: $${shippingTaxAmount}`);
        } else if (orderData.shipping_cost) {
          shippingCost = orderData.shipping_cost || 0;
          console.log(`Costo de env\u00edo (campo directo): $${shippingCost}`);
        }

        if (subtotal === 0 || taxAmount === 0) {
          if (taxRate > 0 && totalAmount > 0) {
            const totalWithoutShipping = totalAmount - shippingCost - shippingTaxAmount;
            subtotal = totalWithoutShipping / (1 + taxRate / 100);
            taxAmount = totalWithoutShipping - subtotal;
          } else {
            subtotal = totalAmount - shippingCost - shippingTaxAmount;
            taxAmount = 0;
            taxRate = 0;
          }
        } else {
          totalAmount = subtotal + taxAmount + shippingCost + shippingTaxAmount;
        }

        console.log(`C\u00e1lculos financieros: Subtotal=${subtotal}, IVA=${taxAmount} (${taxRate}%), Env\u00edo=${shippingCost}, IVA Env\u00edo=${shippingTaxAmount}, Total=${totalAmount}`);

        const shippingAddress = orderData.shipping_info?.shipping_address || orderData.shipping_address || `${customerData.calle} ${customerData.numero}`;
        const orderCurrency = orderData.items && orderData.items.length > 0 ? orderData.items[0].currency : 'UYU';
        console.log("Moneda de la orden:", orderCurrency);

        const commissionAmount = orderData.commission_amount || 0;
        const commissionRate = totalAmount > 0 && commissionAmount > 0
          ? (commissionAmount / totalAmount) * 100
          : 0;

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            order_number: orderNumber,
            client_id: clientId,
            status: orderData.status || 'pending',
            payment_status: orderData.payment_status || 'unpaid',
            payment_method: orderData.payment_method || 'unknown',
            total_amount: totalAmount,
            subtotal: subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount + shippingTaxAmount,
            discount_amount: 0,
            shipping_cost: shippingCost,
            shipping_address: shippingAddress,
            billing_address: shippingAddress,
            currency: orderCurrency,
            external_order_id: orderData.id,
            external_partner_id: orderData.partner_id,
            commission_amount: commissionAmount,
            commission_rate: Math.round(commissionRate * 100) / 100,
            notes: `Orden importada desde DogCatify (${orderData.items[0]?.partnerName || 'Partner'})\nTipo: ${orderData.order_type}\nM\u00e9todo de pago: ${orderData.payment_method}\nMonto partner: ${orderData.partner_amount}\nComisi\u00f3n: ${orderData.commission_amount}${shippingCost > 0 ? `\nEnv\u00edo: $${shippingCost} (IVA: $${shippingTaxAmount})` : ''}`,
            metadata: orderData,
            order_date: new Date(orderData.created_at).toISOString().split('T')[0]
          })
          .select()
          .single();

        if (orderError) {
          console.error("Error creando orden:", orderError);
          throw orderError;
        }

        console.log("\u2713 Orden creada:", order.id);

        if (orderData.items && orderData.items.length > 0) {
          const orderItems = orderData.items.map((item) => {
            const unitPrice = item.original_price || item.price;
            const discountPercent = item.discount_percentage || 0;
            const priceAfterDiscount = unitPrice * (1 - discountPercent / 100);
            const lineTotal = item.quantity * priceAfterDiscount;

            const itemType = orderData.order_type === 'service' ? 'service' : 'product';
            const partnerName = item.partnerName || (orderData.items[0]?.partnerName) || 'Partner';

            return {
              order_id: order.id,
              product_name: item.name,
              description: `${item.name} - ${partnerName}`,
              quantity: item.quantity,
              unit_price: unitPrice,
              line_total: lineTotal,
              total_price: lineTotal,
              discount_percent: discountPercent,
              external_product_id: item.id,
              item_type: itemType,
              currency: item.currency || 'UYU',
              notes: item.image ? `Imagen: ${item.image}` : ''
            };
          });

          const { error: itemsError } = await supabase
            .from("order_items")
            .insert(orderItems);

          if (itemsError) {
            console.error("Error creando items:", itemsError);
          } else {
            console.log(`\u2713 ${orderItems.length} items creados`);
          }
        }

        break;
      }

      case "order.update":
      case "order.updated": {
        console.log("Procesando actualizaci\u00f3n de orden...");

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
              console.log('\u2713 Pago confirmado - Status de orden actualizado a "confirmed"');
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

          console.log("\u2713 Orden actualizada:", existingOrder.id);
          console.log("Campos actualizados:", updateData);
        } else {
          console.warn("Orden no encontrada para actualizar:", orderData.id);
        }

        break;
      }

      case "order.cancelled": {
        console.log("Procesando cancelaci\u00f3n de orden...");

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

          console.log("\u2713 Orden cancelada:", existingOrder.id);
        }

        break;
      }

      case "order.completed": {
        console.log("Procesando completaci\u00f3n de orden...");

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

          console.log("\u2713 Orden completada:", existingOrder.id);
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