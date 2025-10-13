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
    console.log("=== TWILIO RECORDING CALLBACK ===");
    console.log("Method:", req.method);
    console.log("URL:", req.url);

    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const body = await req.text();
      console.log("Twilio recording POST body:", body);

      const urlParams = new URLSearchParams(body);
      params = Object.fromEntries(urlParams.entries());
    } else {
      const url = new URL(req.url);
      params = Object.fromEntries(url.searchParams.entries());
    }

    console.log("Recording callback params:", JSON.stringify(params, null, 2));

    const callSid = params.CallSid || "";
    const recordingSid = params.RecordingSid || "";
    const recordingUrl = params.RecordingUrl || "";
    const recordingStatus = params.RecordingStatus || "";
    const recordingDuration = params.RecordingDuration || "0";
    const recordingChannels = params.RecordingChannels || "1";

    console.log("Extracted recording data:", {
      callSid,
      recordingSid,
      recordingUrl,
      recordingStatus,
      recordingDuration,
      recordingChannels
    });

    if (!callSid || !recordingSid) {
      console.error("Missing CallSid or RecordingSid");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Solo procesar si la grabación está completada
    if (recordingStatus === 'completed') {
      console.log("Recording completed, saving to database...");

      // Construir URL completa de la grabación en formato MP3
      const fullRecordingUrl = recordingUrl.includes('http') 
        ? recordingUrl.replace('.json', '.mp3')
        : `https://api.twilio.com${recordingUrl.replace('.json', '.mp3')}`;

      console.log("Full recording URL:", fullRecordingUrl);

      // Actualizar la llamada con la información de la grabación
      const { error: updateError, data: updateData } = await supabaseAdmin
        .from('calls')
        .update({ 
          recording_url: fullRecordingUrl,
          recording_sid: recordingSid
        })
        .eq('call_sid', callSid)
        .select();

      if (updateError) {
        console.error("Error updating call with recording:", updateError);
      } else {
        console.log("Call updated with recording successfully:", updateData);
      }

      // Nota: No usamos una tabla separada call_recordings porque toda la información
      // de grabación se almacena directamente en la tabla calls
    } else {
      console.log("Recording status is not completed:", recordingStatus);
    }

    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error: any) {
    console.error("Error in twilio-recording-callback:", error);
    console.error("Error stack:", error.stack);

    return new Response("Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});