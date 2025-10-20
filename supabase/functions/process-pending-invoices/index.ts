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

    console.log("🔍 Buscando facturas pendientes de validación...");

    const { data: pendingInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select("id, invoice_number")
      .eq("pending_validation", true)
      .eq("status", "draft")
      .limit(10);

    if (fetchError) {
      throw new Error("Error buscando facturas: " + fetchError.message);
    }

    if (!pendingInvoices || pendingInvoices.length === 0) {
      console.log("✅ No hay facturas pendientes de validación");
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

    console.log(`📋 Encontradas ${pendingInvoices.length} facturas pendientes`);

    const results = [];

    for (const invoice of pendingInvoices) {
      console.log(`🚀 Procesando factura ${invoice.invoice_number}...`);

      try {
        const validateUrl = `${supabaseUrl}/functions/v1/validate-invoice-external`;

        const response = await fetch(validateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            invoice_id: invoice.id
          })
        });

        const result = await response.json();

        if (response.ok) {
          console.log(`✅ Factura ${invoice.invoice_number} procesada exitosamente`);
          results.push({
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            success: true,
            result: result
          });
        } else {
          console.error(`❌ Error procesando factura ${invoice.invoice_number}:`, result);
          results.push({
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            success: false,
            error: result.error || result.message
          });
        }

        await supabase
          .from("invoices")
          .update({ pending_validation: false })
          .eq("id", invoice.id);

      } catch (error: any) {
        console.error(`❌ Error llamando validación para ${invoice.invoice_number}:`, error);
        results.push({
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          success: false,
          error: error.message
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
    console.error("❌ Error procesando facturas pendientes:", error);
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
