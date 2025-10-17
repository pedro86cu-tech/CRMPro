import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Dogcatify-Signature",
};

interface CustomerData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}

interface WebhookPayload {
  success: boolean;
  data: {
    order: {
      id: string;
      partner_id: string;
      customer_id: string;
      status: string;
      total_amount: number;
      order_type?: string;
      items: Array<{
        product_id: string;
        quantity: number;
        price: number;
      }>;
      payment_method: string;
      payment_status: string;
      created_at: string;
      updated_at?: string;
      customer?: CustomerData;
    };
  };
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

  // Validar que sea una petición POST
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

    // Validar que haya contenido en el body
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

    // Extraer el evento y los datos
    const event = rawPayload.action || rawPayload.event;
    const payload: WebhookPayload = rawPayload;

    console.log("Evento/Acción:", event);
    console.log("Order ID:", payload.data?.order?.id);

    // Verificar firma si está configurada
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

    // Procesar según el tipo de evento
    switch (event) {
      case "order.created": {
        console.log("Procesando nueva orden...");

        const orderData = payload.data.order;
        const customerData = orderData.customer;

        // Buscar o crear el cliente basado en customer_id
        let clientId = null;

        // Buscar cliente existente por external_id (customer_id de DogCatify)
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("external_id", orderData.customer_id)
          .maybeSingle();

        if (existingClient) {
          clientId = existingClient.id;
          console.log("✓ Cliente existente encontrado:", clientId);

          // Actualizar datos del cliente si vienen en el webhook
          if (customerData) {
            const { error: updateError } = await supabase
              .from("clients")
              .update({
                contact_name: customerData.full_name,
                email: customerData.email,
                phone: customerData.phone,
                address: customerData.address,
                city: customerData.city,
                country: customerData.country,
                updated_at: new Date().toISOString()
              })
              .eq("id", clientId);

            if (!updateError) {
              console.log("✓ Datos del cliente actualizados");
            }
          }
        } else {
          // Crear nuevo cliente con los datos del webhook
          const clientInsertData: any = {
            external_id: orderData.customer_id,
            status: "active",
            source: "dogcatify"
          };

          // Si vienen los datos del cliente, usarlos
          if (customerData) {
            clientInsertData.contact_name = customerData.full_name;
            clientInsertData.email = customerData.email;
            clientInsertData.phone = customerData.phone;
            clientInsertData.address = customerData.address;
            clientInsertData.city = customerData.city;
            clientInsertData.country = customerData.country;
            clientInsertData.company_name = customerData.full_name; // Usar el nombre como company_name si no hay empresa
          } else {
            // Fallback si no vienen datos del cliente
            clientInsertData.company_name = `Cliente DogCatify ${orderData.customer_id.substring(0, 8)}`;
          }

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

        // Generar número de orden único
        const orderNumber = `DC-${Date.now()}-${orderData.id.substring(0, 8)}`;

        // Crear la orden
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            order_number: orderNumber,
            client_id: clientId,
            status: orderData.status,
            total_amount: orderData.total_amount,
            payment_method: orderData.payment_method,
            payment_status: orderData.payment_status,
            external_order_id: orderData.id,
            external_partner_id: orderData.partner_id,
            notes: `Orden importada desde DogCatify\nTipo: ${orderData.order_type || 'N/A'}\nMétodo de pago: ${orderData.payment_method}\nEstado de pago: ${orderData.payment_status}`,
            metadata: orderData
          })
          .select()
          .single();
        
        if (orderError) {
          console.error("Error creando orden:", orderError);
          throw orderError;
        }
        
        console.log("✓ Orden creada:", order.id);

        // Crear los items de la orden
        if (orderData.items && orderData.items.length > 0) {
          const orderItems = orderData.items.map((item) => ({
            order_id: order.id,
            product_name: item.product_id,
            description: `Producto: ${item.product_id}`,
            quantity: item.quantity,
            unit_price: item.price,
            line_total: item.quantity * item.price,
            total_price: item.quantity * item.price,
            external_product_id: item.product_id,
            item_type: 'product'
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

        const orderData = payload.data.order;

        // Buscar la orden por external_order_id
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

          // Solo actualizar campos si están presentes en el webhook
          if (orderData.status) {
            updateData.status = orderData.status;
          }
          if (orderData.payment_status) {
            updateData.payment_status = orderData.payment_status;
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

        const orderData = payload.data.order;

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

        const orderData = payload.data.order;

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
        order_id: payload.data?.order?.id
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
