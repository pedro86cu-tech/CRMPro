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

interface DogCatifyPartner {
  id: string;
  rut: string;
  calle: string;
  email: string;
  phone: string;
  barrio: string;
  numero: string;
  business_name: string;
  codigo_postal: string;
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
  partner?: DogCatifyPartner;
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

    const signatureBytes = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const expected = Array.from(new Uint8Array(signatureBytes))
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

    const payload: WebhookPayload = await req.json();
    console.log("Payload recibido:", JSON.stringify(payload, null, 2));

    const { event, order_id, data: orderData } = payload;

    if (!event || !order_id || !orderData) {
      return new Response(
        JSON.stringify({
          error: "Invalid payload",
          message: "El payload debe contener event, order_id y data"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Evento:", event);
    console.log("Order ID:", order_id);

    if (signature) {
      console.log("Verificando firma...");
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

        // Procesar y registrar Partner si viene en el webhook
        let partnerId = null;
        if (orderData.partner) {
          const partnerData = orderData.partner;
          console.log("Procesando partner:", partnerData.business_name);

          const { data: existingPartner } = await supabase
            .from("partners")
            .select("id")
            .eq("external_id", partnerData.id)
            .maybeSingle();

          if (existingPartner) {
            partnerId = existingPartner.id;
            console.log("✓ Partner existente encontrado:", partnerId);

            // Actualizar datos del partner
            const { error: updatePartnerError } = await supabase
              .from("partners")
              .update({
                name: partnerData.business_name,
                business_name: partnerData.business_name,
                rut: partnerData.rut,
                email: partnerData.email,
                phone: partnerData.phone,
                calle: partnerData.calle,
                numero: partnerData.numero,
                barrio: partnerData.barrio,
                postal_code: partnerData.codigo_postal,
                address: `${partnerData.calle} ${partnerData.numero}, ${partnerData.barrio}`,
                city: partnerData.barrio,
                country: "Uruguay",
                updated_at: new Date().toISOString()
              })
              .eq("id", partnerId);

            if (!updatePartnerError) {
              console.log("✓ Datos del partner actualizados");
            }
          } else {
            // Crear nuevo partner
            const partnerInsertData = {
              external_id: partnerData.id,
              name: partnerData.business_name,
              business_name: partnerData.business_name,
              rut: partnerData.rut,
              email: partnerData.email,
              phone: partnerData.phone,
              calle: partnerData.calle,
              numero: partnerData.numero,
              barrio: partnerData.barrio,
              postal_code: partnerData.codigo_postal,
              address: `${partnerData.calle} ${partnerData.numero}, ${partnerData.barrio}`,
              city: partnerData.barrio,
              country: "Uruguay",
              is_active: true
            };

            const { data: newPartner, error: partnerError } = await supabase
              .from("partners")
              .insert(partnerInsertData)
              .select("id")
              .single();

            if (partnerError) {
              console.error("Error creando partner:", partnerError);
            } else {
              partnerId = newPartner.id;
              console.log("✓ Partner creado:", partnerId);
            }
          }
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
          console.log(`Costo de envío detectado: $${shippingCost}, IVA envío: $${shippingTaxAmount}`);
        } else if (orderData.shipping_cost) {
          shippingCost = orderData.shipping_cost || 0;
          console.log(`Costo de envío (campo directo): $${shippingCost}`);
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

        console.log(`Cálculos financieros: Subtotal=${subtotal}, IVA=${taxAmount} (${taxRate}%), Envío=${shippingCost}, IVA Envío=${shippingTaxAmount}, Total=${totalAmount}`);

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
            partner_id: partnerId,
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
            notes: `Orden importada desde DogCatify (${orderData.items[0]?.partnerName || 'Partner'})\nTipo: ${orderData.order_type}\nMétodo de pago: ${orderData.payment_method}\nMonto partner: ${orderData.partner_amount}\nComisión: ${orderData.commission_amount}${shippingCost > 0 ? `\nEnvío: $${shippingCost} (IVA: $${shippingTaxAmount})` : ''}`,
            metadata: orderData,
            order_date: new Date(orderData.created_at).toISOString().split('T')[0]
          })
          .select()
          .single();

        if (orderError) {
          console.error("Error creando orden:", orderError);
          throw orderError;
        }

        console.log("✓ Orden creada:", orderNumber, "ID:", order.id);

        for (const item of orderData.items) {
          const itemCurrencyCode = item.currency_code_dgi || (item.currency === 'UYU' ? '858' : item.currency === 'USD' ? '840' : '858');
          const itemIvaRate = item.iva_rate || taxRate || 0;
          const itemSubtotal = item.subtotal || (item.price * item.quantity);
          const itemIvaAmount = item.iva_amount || (itemSubtotal * (itemIvaRate / 100));

          const { error: itemError } = await supabase
            .from("order_items")
            .insert({
              order_id: order.id,
              product_name: item.name,
              description: `Partner: ${item.partnerName}`,
              quantity: item.quantity,
              unit_price: item.price,
              discount_percent: item.discount_percentage || 0,
              line_total: itemSubtotal,
              total_price: itemSubtotal + itemIvaAmount,
              currency: itemCurrencyCode
            });

          if (itemError) {
            console.error("Error insertando item:", itemError);
          }
        }

        console.log("✓ Items de orden insertados:", orderData.items.length);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Orden procesada exitosamente",
            order: {
              id: order.id,
              order_number: orderNumber
            }
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "order.updated": {
        console.log("Actualizando orden existente...");

        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("external_order_id", orderData.id)
          .maybeSingle();

        if (!existingOrder) {
          return new Response(
            JSON.stringify({
              error: "Order not found",
              message: `No se encontró una orden con external_order_id: ${orderData.id}`
            }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { error: updateError } = await supabase
          .from("orders")
          .update({
            status: orderData.status,
            payment_status: orderData.payment_status,
            payment_method: orderData.payment_method,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingOrder.id);

        if (updateError) {
          console.error("Error actualizando orden:", updateError);
          throw updateError;
        }

        console.log("✓ Orden actualizada:", existingOrder.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Orden actualizada exitosamente",
            order: {
              id: existingOrder.id
            }
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        console.log("Evento no manejado:", event);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Evento ${event} recibido pero no procesado`
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Error procesando webhook:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Error desconocido"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});