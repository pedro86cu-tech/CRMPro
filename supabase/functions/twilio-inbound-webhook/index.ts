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
    console.log("Twilio Inbound Webhook received");
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

    console.log("Parsed params:", params);

    const callSid = params.CallSid;
    const fromNumber = params.From;
    const toNumber = params.To;
    const callStatus = params.CallStatus;
    const recordingUrl = params.RecordingUrl;
    const recordingSid = params.RecordingSid;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verificar si ya existe la llamada para evitar duplicados
    const { data: existingCall } = await supabase
      .from("incoming_calls")
      .select("id, status")
      .eq("call_sid", callSid)
      .maybeSingle();

    // Solo registrar llamadas nuevas en estado ringing
    if (!existingCall && callStatus === "ringing") {
      const { error } = await supabase
        .from("incoming_calls")
        .insert({
          call_sid: callSid,
          from_number: fromNumber,
          to_number: toNumber,
          status: "ringing",
        });

      if (error) {
        console.error("Error inserting incoming call:", error);
      } else {
        console.log("Incoming call registered:", callSid);
      }

      // Responder con TwiML que SOLO hace esperar con música
      // NO intenta conectar a ningún número ni cliente
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lupe" language="es-MX">Por favor espere mientras lo conectamos con un agente.</Say>
  <Play loop="50">https://demo.twilio.com/docs/classic.mp3</Play>
</Response>`;

      return new Response(twiml, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/xml",
        },
      });
    }
    // Actualizar estado de llamadas existentes (callbacks de grabación, etc)
    else if (existingCall) {
      const updateData: any = {};
      
      if (recordingUrl && recordingSid) {
        updateData.recording_url = recordingUrl;
        updateData.recording_sid = recordingSid;
        console.log("Recording received:", recordingSid);
      }
      
      if (callStatus === "completed") {
        updateData.ended_at = new Date().toISOString();
        // Si fue contestada, marcar como finalizada; sino como perdida
        if (existingCall.status === "answered") {
          updateData.status = "ended";
        } else {
          updateData.status = "missed";
        }
      } else if (callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
        updateData.status = "missed";
        updateData.ended_at = new Date().toISOString();
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from("incoming_calls")
          .update(updateData)
          .eq("call_sid", callSid);

        if (error) {
          console.error("Error updating incoming call:", error);
        } else {
          console.log("Incoming call updated:", updateData);
        }
      }
    }

    // Para callbacks que no necesitan TwiML, solo responder OK
    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error: any) {
    console.error("Error in twilio-inbound-webhook:", error);

    // En caso de error, colgar la llamada
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lupe" language="es-MX">Lo sentimos, ocurrió un error. Por favor intente más tarde.</Say>
  <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/xml",
      },
    });
  }
});