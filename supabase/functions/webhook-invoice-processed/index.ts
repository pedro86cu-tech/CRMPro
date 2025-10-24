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
    console.log("📥 Webhook recibido:", JSON.stringify(payload, null, 2));

    const {
      invoice_id,
      invoice_number,
      // Datos de DGI
      dgi_estado,
      dgi_codigo_autorizacion,
      dgi_mensaje,
      dgi_id_efactura,
      dgi_fecha_validacion,
      // Datos de PDF
      pdf_id,
      pdf_base64,
      pdf_filename,
      pdf_size_bytes,
      pdf_generated_at,
      // Estado general
      status,
    } = payload;

    if (!invoice_id && !invoice_number) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Se requiere invoice_id o invoice_number" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Buscar la factura por ID o número
    let invoiceQuery = supabase.from("invoices").select("*");
    
    if (invoice_id) {
      invoiceQuery = invoiceQuery.eq("id", invoice_id);
    } else if (invoice_number) {
      invoiceQuery = invoiceQuery.eq("invoice_number", invoice_number);
    }

    const { data: invoice, error: findError } = await invoiceQuery.maybeSingle();

    if (findError || !invoice) {
      console.error("❌ Factura no encontrada:", findError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Factura no encontrada",
          invoice_id,
          invoice_number
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Factura encontrada:", invoice.id, invoice.invoice_number);

    // Preparar datos para actualizar
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Actualizar campos de DGI si vienen
    if (dgi_estado) updateData.dgi_estado = dgi_estado;
    if (dgi_codigo_autorizacion) updateData.dgi_codigo_autorizacion = dgi_codigo_autorizacion;
    if (dgi_mensaje) updateData.dgi_mensaje = dgi_mensaje;
    if (dgi_id_efactura) updateData.dgi_id_efactura = dgi_id_efactura;
    if (dgi_fecha_validacion) updateData.dgi_fecha_validacion = dgi_fecha_validacion;

    // Actualizar campos de PDF si vienen
    if (pdf_id) updateData.pdf_id = pdf_id;
    if (pdf_base64) updateData.pdf_base64 = pdf_base64;
    if (pdf_filename) updateData.pdf_filename = pdf_filename;
    if (pdf_size_bytes) updateData.pdf_size_bytes = pdf_size_bytes;
    if (pdf_generated_at) updateData.pdf_generated_at = pdf_generated_at;

    // Actualizar estado si viene
    if (status) updateData.status = status;

    console.log("📝 Actualizando factura con:", updateData);

    // Actualizar factura
    const { data: updated, error: updateError } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoice.id)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error actualizando factura:", updateError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: updateError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Factura actualizada exitosamente:", updated.id);

    // Si hay PDF, actualizar también la cola de PDFs
    if (pdf_id) {
      const { error: queueError } = await supabase
        .from("invoice_pdf_queue")
        .update({
          status: "sent",
          pdf_id: pdf_id,
          processed_at: new Date().toISOString(),
        })
        .eq("invoice_id", invoice.id)
        .eq("status", "processing");

      if (queueError) {
        console.warn("⚠️ Error actualizando PDF queue:", queueError);
      } else {
        console.log("✅ PDF queue actualizado");
      }
    }

    // Registrar en historial de validaciones
    if (dgi_estado) {
      const { error: logError } = await supabase
        .from("external_validation_logs")
        .insert({
          config_id: (await supabase
            .from("external_invoice_api_config")
            .select("id")
            .eq("config_type", "dgi_validation")
            .eq("is_active", true)
            .maybeSingle()
          ).data?.id,
          invoice_id: invoice.id,
          request_payload: payload,
          response_payload: updated,
          status_code: 200,
          success: dgi_estado === "aprobado",
        });

      if (logError) {
        console.warn("⚠️ Error registrando log:", logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: updated.id,
        invoice_number: updated.invoice_number,
        status: updated.status,
        dgi_estado: updated.dgi_estado,
        pdf_id: updated.pdf_id,
        message: "Factura actualizada exitosamente",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Error procesando webhook:", error);
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