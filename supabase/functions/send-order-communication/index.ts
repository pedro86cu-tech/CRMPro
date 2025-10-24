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

    const { data: emailConfig } = await supabase
      .from("external_invoice_api_config")
      .select("*")
      .eq("config_type", "email_communication")
      .eq("is_active", true)
      .maybeSingle();

    if (!emailConfig) {
      console.error("❌ No hay configuración activa de Email Communication");
      
      await supabase
        .from("orders")
        .update({ status: "sent-error-email" })
        .eq("id", order_id);
      
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

    const communicationPayload = {
      template_name,
      recipient_email,
      order_id,
      wait_for_invoice: wait_for_invoice || false,
      data: data || {},
    };

    const { data: logEntry, error: logError } = await supabase
      .from("external_invoice_validation_log")
      .insert({
        config_id: emailConfig.id,
        invoice_id: null,
        request_payload: communicationPayload,
        response_payload: null,
        status_code: null,
        status: 'pending',
        external_reference: order_id,
      })
      .select()
      .single();

    if (logError) {
      console.error("⚠️ Error creando log:", logError);
    } else {
      console.log("📝 Log creado:", logEntry.id);
    }

    console.log("🚀 Llamando a pending-communication:", emailConfig.api_url);

    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...emailConfig.headers || {},
    };

    if (emailConfig.auth_type === 'api_key' && emailConfig.auth_credentials) {
      const { key, value } = emailConfig.auth_credentials;
      fetchHeaders[key] = value;
    } else if (emailConfig.auth_type === 'bearer' && emailConfig.auth_credentials?.token) {
      fetchHeaders['Authorization'] = `Bearer ${emailConfig.auth_credentials.token}`;
    }

    console.log("🔑 Headers preparados:", Object.keys(fetchHeaders).join(', '));

    const startTime = Date.now();
    let communicationResponse;
    let communicationResult: any;

    try {
      communicationResponse = await fetch(emailConfig.api_url, {
        method: "POST",
        headers: fetchHeaders,
        body: JSON.stringify(communicationPayload),
      });
      
      const duration = Date.now() - startTime;
      const responseText = await communicationResponse.text();

      try {
        communicationResult = JSON.parse(responseText);
      } catch {
        communicationResult = { raw: responseText };
      }

      console.log("📨 Respuesta de pending-communication:", communicationResult);

      const isSuccess = communicationResponse.ok &&
                       (communicationResult.success === true ||
                        communicationResult.success === undefined);

      console.log(`✅ Análisis de respuesta: HTTP ${communicationResponse.status}, success=${communicationResult.success}, isSuccess=${isSuccess}`);

      if (logEntry) {
        await supabase
          .from("external_invoice_validation_log")
          .update({
            response_payload: communicationResult,
            status_code: communicationResponse.status,
            status: isSuccess ? "success" : "error",
            validation_result: isSuccess ? "approved" : "rejected",
            duration_ms: duration,
          })
          .eq("id", logEntry.id);
      }

      if (!isSuccess) {
        console.error("❌ Error en pending-communication - Actualizando orden a sent-error-email");

        await supabase
          .from("orders")
          .update({ status: "sent-error-email" })
          .eq("id", order_id);

        return new Response(
          JSON.stringify({
            success: false,
            error: "Error en la comunicación por email",
            status: communicationResponse.status,
            details: communicationResult,
            order_status_updated: "sent-error-email",
          }),
          {
            status: communicationResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("✅ Comunicación enviada exitosamente - Actualizando orden a 'shipped'");

      await supabase
        .from("orders")
        .update({ status: "shipped" })
        .eq("id", order_id);

      return new Response(
        JSON.stringify({
          success: true,
          order_id: order.id,
          order_number: order.order_number,
          template_name,
          recipient_email,
          communication_response: communicationResult,
          order_status_updated: "shipped",
          message: "Comunicación enviada exitosamente",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
      
    } catch (fetchError) {
      console.error("❌ Error llamando a pending-communication:", fetchError);
      
      await supabase
        .from("orders")
        .update({ status: "sent-error-email" })
        .eq("id", order_id);
      
      if (logEntry) {
        await supabase
          .from("external_invoice_validation_log")
          .update({
            response_payload: { error: fetchError.message },
            status_code: 0,
            status: "error",
            validation_result: "rejected",
            duration_ms: Date.now() - startTime,
          })
          .eq("id", logEntry.id);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Error de red llamando a pending-communication",
          details: fetchError.message,
          order_status_updated: "sent-error-email",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
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