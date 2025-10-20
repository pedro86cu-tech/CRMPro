import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🔍 Buscando facturas en cola de emails...");

    // Obtener estado configurado para envío exitoso (buscar "sent" o el siguiente después de validated)
    const { data: sentStatus } = await supabase
      .from("invoice_statuses")
      .select("code")
      .eq("code", "sent")
      .eq("is_active", true)
      .single();

    // Obtener estado configurado para error en envío
    const { data: errorStatus } = await supabase
      .from("invoice_statuses")
      .select("code")
      .eq("code", "sent-error")
      .eq("is_active", true)
      .single();

    const sentStatusCode = sentStatus?.code || "sent";
    const errorStatusCode = errorStatus?.code || "sent-error";

    console.log(`📋 Estados configurados: exitoso="${sentStatusCode}", error="${errorStatusCode}"`);

    // Buscar facturas pendientes en la cola
    const { data: queueItems, error: queueError } = await supabase
      .from("invoice_email_queue")
      .select("id, invoice_id, attempts")
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(5);

    if (queueError) {
      throw new Error("Error buscando cola: " + queueError.message);
    }

    if (!queueItems || queueItems.length === 0) {
      console.log("✅ No hay facturas pendientes de envío");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No hay facturas pendientes",
          processed: 0
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`📋 Encontradas ${queueItems.length} facturas en cola`);

    const results = [];

    for (const item of queueItems) {
      console.log(`🚀 Procesando factura ${item.invoice_id}...`);

      try {
        // Marcar como processing
        await supabase
          .from("invoice_email_queue")
          .update({ status: "processing" })
          .eq("id", item.id);

        // Llamar a send-invoice-email
        const sendUrl = `${supabaseUrl}/functions/v1/send-invoice-email`;
        const response = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            invoice_id: item.invoice_id
          })
        });

        const result = await response.json();

        if (response.ok) {
          console.log(`✅ Email enviado exitosamente para factura ${item.invoice_id}`);

          // Actualizar estado de la factura a "sent"
          await supabase
            .from("invoices")
            .update({
              status: sentStatusCode,
              observations: null // Limpiar observaciones si había error previo
            })
            .eq("id", item.invoice_id);

          // Marcar como sent en la cola
          await supabase
            .from("invoice_email_queue")
            .update({
              status: "sent",
              processed_at: new Date().toISOString()
            })
            .eq("id", item.id);

          results.push({
            invoice_id: item.invoice_id,
            success: true,
            message: "Email enviado exitosamente"
          });

        } else {
          console.error(`❌ Error enviando email para ${item.invoice_id}:`, result);

          const errorMessage = result.error || result.message || "Error desconocido al enviar email";

          // Actualizar estado de la factura a "sent-error"
          await supabase
            .from("invoices")
            .update({
              status: errorStatusCode,
              observations: `Error al enviar email: ${errorMessage}`
            })
            .eq("id", item.invoice_id);

          // Incrementar intentos
          const newAttempts = (item.attempts || 0) + 1;
          const maxAttempts = 3;

          if (newAttempts >= maxAttempts) {
            // Marcar como failed después de 3 intentos
            await supabase
              .from("invoice_email_queue")
              .update({
                status: "failed",
                attempts: newAttempts,
                last_error: errorMessage,
                processed_at: new Date().toISOString()
              })
              .eq("id", item.id);

            console.log(`❌ Factura ${item.invoice_id} marcada como failed después de ${newAttempts} intentos`);
          } else {
            // Volver a pending para reintentar
            await supabase
              .from("invoice_email_queue")
              .update({
                status: "pending",
                attempts: newAttempts,
                last_error: errorMessage
              })
              .eq("id", item.id);

            console.log(`⚠️ Factura ${item.invoice_id} volverá a intentarse (intento ${newAttempts}/${maxAttempts})`);
          }

          results.push({
            invoice_id: item.invoice_id,
            success: false,
            error: errorMessage,
            attempts: newAttempts
          });
        }

      } catch (error: any) {
        console.error(`❌ Error procesando ${item.invoice_id}:`, error);

        const errorMessage = error.message || "Error desconocido";

        // Actualizar estado de la factura a "sent-error"
        await supabase
          .from("invoices")
          .update({
            status: errorStatusCode,
            observations: `Error al procesar envío: ${errorMessage}`
          })
          .eq("id", item.invoice_id);

        // Incrementar intentos
        const newAttempts = (item.attempts || 0) + 1;
        await supabase
          .from("invoice_email_queue")
          .update({
            status: newAttempts >= 3 ? "failed" : "pending",
            attempts: newAttempts,
            last_error: errorMessage
          })
          .eq("id", item.id);

        results.push({
          invoice_id: item.invoice_id,
          success: false,
          error: errorMessage
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`✅ Procesamiento completado: ${successCount} exitosas, ${failureCount} fallidas`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        results: results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("❌ Error procesando cola de emails:", error);
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
