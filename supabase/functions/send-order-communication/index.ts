import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("📥 Solicitud de comunicación recibida:", JSON.stringify(payload, null, 2));

    const {
      template_name,
      recipient_email,
      order_id,
      wait_for_invoice,
      data,
    } = payload;

    if (!template_name || !recipient_email || !order_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Se requiere template_name, recipient_email y order_id" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Buscar la orden
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      console.error("❌ Orden no encontrada:", order_id);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Orden no encontrada: ${order_id}` 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Orden encontrada:", order.id, order.order_number);

    // Obtener configuración de Email Communication
    const { data: emailConfig } = await supabase
      .from("external_invoice_api_config")
      .select("*")
      .eq("config_type", "email_communication")
      .eq("is_active", true)
      .maybeSingle();

    if (!emailConfig) {
      console.error("❌ No hay configuración activa de Email Communication");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No hay configuración activa de comunicación por email" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("🔧 Configuración Email encontrada:", emailConfig.name, emailConfig.api_url);

    // Preparar el payload para pending-communication
    const communicationPayload = {
      template_name,
      recipient_email,
      order_id,
      wait_for_invoice: wait_for_invoice || false,
      data: data || {},
    };

    // Registrar en external_validation_logs ANTES de llamar
    const { data: logEntry, error: logError } = await supabase
      .from("external_validation_logs")
      .insert({
        config_id: emailConfig.id,
        invoice_id: null,
        request_payload: communicationPayload,
        response_payload: null,
        status_code: null,
        success: null,
        external_reference: order_id,
      })
      .select()
      .single();

    if (logError) {
      console.error("⚠️ Error creando log:", logError);
    } else {
      console.log("📝 Log creado:", logEntry.id);
    }

    // Llamar a la API externa pending-communication
    console.log("🚀 Llamando a pending-communication:", emailConfig.api_url);
    
    const startTime = Date.now();
    const communicationResponse = await fetch(emailConfig.api_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(emailConfig.api_key ? { "Authorization": `Bearer ${emailConfig.api_key}` } : {}),
      },
      body: JSON.stringify(communicationPayload),
    });
    const duration = Date.now() - startTime;

    const responseText = await communicationResponse.text();
    let communicationResult: any;

    try {
      communicationResult = JSON.parse(responseText);
    } catch {
      communicationResult = { raw: responseText };
    }

    console.log("📨 Respuesta de pending-communication:", communicationResult);

    // Actualizar el log con la respuesta
    if (logEntry) {
      await supabase
        .from("external_validation_logs")
        .update({
          response_payload: communicationResult,
          status_code: communicationResponse.status,
          success: communicationResponse.ok,
          status: communicationResponse.ok ? "success" : "error",
          validation_result: communicationResponse.ok ? "approved" : "rejected",
          duration_ms: duration,
        })
        .eq("id", logEntry.id);
    }

    if (!communicationResponse.ok) {
      console.error("❌ Error en pending-communication:", communicationResponse.status, communicationResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Error llamando a pending-communication",
          status: communicationResponse.status,
          details: communicationResult,
        }),
        {
          status: communicationResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Comunicación enviada exitosamente");

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_number: order.order_number,
        template_name,
        recipient_email,
        communication_response: communicationResult,
        message: "Comunicación enviada exitosamente",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error procesando comunicación:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});