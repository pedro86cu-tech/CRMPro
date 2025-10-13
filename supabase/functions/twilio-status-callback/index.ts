import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    console.log("=== TWILIO STATUS CALLBACK ===");
    console.log("Method:", req.method);
    console.log("URL:", req.url);

    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await req.text();
      console.log("Twilio POST body:", body);

      const urlParams = new URLSearchParams(body);
      params = Object.fromEntries(urlParams.entries());
    } else {
      const url = new URL(req.url);
      params = Object.fromEntries(url.searchParams.entries());
    }

    console.log("Status callback params:", JSON.stringify(params, null, 2));

    const callSid = params.CallSid || "";
    const callStatus = params.CallStatus || "";
    const callDuration = params.CallDuration || "0";
    const recordingSid = params.RecordingSid || "";
    const recordingUrl = params.RecordingUrl || "";
    const recordingDuration = params.RecordingDuration || "0";

    console.log("Extracted data:", {
      callSid,
      callStatus,
      callDuration,
      recordingSid,
      recordingUrl,
      recordingDuration
    });

    if (!callSid) {
      console.error("No CallSid provided");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Actualizar el estado de la llamada
    const updateData: any = {
      status: callStatus,
      updated_at: new Date().toISOString()
    };

    // Si la llamada ha terminado, guardar la duración
    if (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer') {
      updateData.duration = parseInt(callDuration, 10);
      updateData.ended_at = new Date().toISOString();
      console.log("Call ended, duration:", callDuration);
    }

    // Actualizar la llamada en la base de datos
    const { error: updateError } = await supabaseAdmin
      .from('calls')
      .update(updateData)
      .eq('call_sid', callSid);

    if (updateError) {
      console.error("Error updating call:", updateError);
    } else {
      console.log("Call updated successfully");
    }

    // Si hay información de grabación, guardarla
    if (recordingSid && recordingUrl) {
      console.log("Recording detected, saving...");

      // Construir URL completa de la grabación (Twilio no envía la extensión en el callback)
      const fullRecordingUrl = recordingUrl.includes('http') 
        ? recordingUrl 
        : `https://api.twilio.com${recordingUrl}`;

      const recordingData = {
        call_sid: callSid,
        recording_sid: recordingSid,
        recording_url: fullRecordingUrl,
        duration: parseInt(recordingDuration, 10),
        status: 'completed',
        created_at: new Date().toISOString()
      };

      // Insertar o actualizar la grabación
      const { error: recordingError } = await supabaseAdmin
        .from('call_recordings')
        .upsert(recordingData, { onConflict: 'recording_sid' });

      if (recordingError) {
        console.error("Error saving recording:", recordingError);
      } else {
        console.log("Recording saved successfully");

        // Actualizar la llamada con la URL de grabación
        await supabaseAdmin
          .from('calls')
          .update({ 
            recording_url: fullRecordingUrl,
            recording_sid: recordingSid 
          })
          .eq('call_sid', callSid);

        console.log("Call updated with recording URL");
      }
    }

    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error("Error in twilio-status-callback:", error);
    console.error("Error stack:", error.stack);

    return new Response("Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});