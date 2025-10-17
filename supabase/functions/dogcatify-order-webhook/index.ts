import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Dogcatify-Signature",
};

interface WebhookPayload {
  event: string;
  order_id: string;
  data: {
    id: string;
    partner_id: string;
    customer_id: string;
    status: string;
    total_amount: number;
    items: Array<{
      product_id: string;
      quantity: number;
      price: number;
    }>;
    payment_method: string;
    payment_status: string;
    created_at: string;
    updated_at: string;
  };
  timestamp: string;
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

  try {
    console.log("=== WEBHOOK DOGCATIFY RECIBIDO ===");
    
    const signature = req.headers.get("x-dogcatify-signature");
    const payload: WebhookPayload = await req.json();
    
    console.log("Evento:", payload.event);
    console.log("Order ID:", payload.order_id);

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
    switch (payload.event) {
      case "order.created": {
        console.log("Procesando nueva orden...");
        
        // Buscar o crear el cliente basado en customer_id
        let clientId = null;
        
        // Buscar cliente existente por external_id (customer_id de DogCatify)
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("external_id", payload.data.customer_id)
          .maybeSingle();
        
        if (existingClient) {
          clientId = existingClient.id;
        } else {
          // Crear nuevo cliente
          const { data: newClient, error: clientError } = await supabase
            .from("clients")
            .insert({
              external_id: payload.data.customer_id,
              company_name: `Cliente DogCatify ${payload.data.customer_id.substring(0, 8)}`,
              status: "active",
              source: "dogcatify"
            })
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
        const orderNumber = `DC-${Date.now()}-${payload.order_id.substring(0, 8)}`;
        
        // Crear la orden
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            order_number: orderNumber,
            client_id: clientId,
            status: payload.data.status,
            total_amount: payload.data.total_amount,
            payment_method: payload.data.payment_method,
            payment_status: payload.data.payment_status,
            external_order_id: payload.data.id,
            external_partner_id: payload.data.partner_id,
            notes: `Orden importada desde DogCatify\nMétodo de pago: ${payload.data.payment_method}\nEstado de pago: ${payload.data.payment_status}`,
            metadata: payload.data
          })
          .select()
          .single();
        
        if (orderError) {
          console.error("Error creando orden:", orderError);
          throw orderError;
        }
        
        console.log("✓ Orden creada:", order.id);

        // Crear los items de la orden
        if (payload.data.items && payload.data.items.length > 0) {
          const orderItems = payload.data.items.map((item) => ({
            order_id: order.id,
            product_name: item.product_id,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.quantity * item.price,
            external_product_id: item.product_id
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

      case "order.updated": {
        console.log("Procesando actualización de orden...");
        
        // Buscar la orden por external_order_id
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("external_order_id", payload.data.id)
          .maybeSingle();
        
        if (existingOrder) {
          const { error: updateError } = await supabase
            .from("orders")
            .update({
              status: payload.data.status,
              payment_status: payload.data.payment_status,
              total_amount: payload.data.total_amount,
              updated_at: new Date().toISOString()
            })
            .eq("id", existingOrder.id);
          
          if (updateError) {
            console.error("Error actualizando orden:", updateError);
            throw updateError;
          }
          
          console.log("✓ Orden actualizada:", existingOrder.id);
        } else {
          console.warn("Orden no encontrada para actualizar:", payload.data.id);
        }
        
        break;
      }

      case "order.cancelled": {
        console.log("Procesando cancelación de orden...");
        
        const { data: existingOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("external_order_id", payload.data.id)
          .maybeSingle();
        
        if (existingOrder) {
          const { error: cancelError } = await supabase
            .from("orders")
            .update({
              status: "cancelled",
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
          .eq("external_order_id", payload.data.id)
          .maybeSingle();
        
        if (existingOrder) {
          const { error: completeError } = await supabase
            .from("orders")
            .update({
              status: "completed",
              payment_status: "paid",
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
        console.warn("Evento no manejado:", payload.event);
    }

    return new Response(
      JSON.stringify({ received: true, order_id: payload.order_id }),
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
