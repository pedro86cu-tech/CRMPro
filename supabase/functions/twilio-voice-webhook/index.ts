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
    console.log("=== TWILIO VOICE WEBHOOK ===");
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

    console.log("Parsed params:", JSON.stringify(params, null, 2));

    const toNumber = params.To || params.Called || "";
    const fromNumber = params.From || params.Caller || "";
    const callSid = params.CallSid || "";
    const direction = params.Direction || "";

    console.log("Call details:", {
      to: toNumber,
      from: fromNumber,
      callSid,
      direction
    });

    // Extraer userId del From identity (formato: \"agent_userId\")
    let userId = "";
    if (fromNumber.startsWith("client:agent_")) {
      userId = fromNumber.replace("client:agent_", "");
      console.log("Extracted userId from client:", userId);
    } else {
      console.log("Call not from a client identity, treating as regular call");
      console.log("Direction:", direction);
    }

    // Determinar si es una llamada outbound (desde el agente)
    const isOutbound = direction === "outbound-api" || (userId && toNumber);

    if (isOutbound && toNumber) {
      console.log("Outbound call detected");
      if (userId) {
        console.log("Agent userId:", userId);
      }
      console.log("Destination:", toNumber);

      // Obtener el número de Twilio de la configuración para usarlo como callerId
      let twilioPhoneNumber = "";
      try {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: config } = await supabaseAdmin
          .from('twilio_config')
          .select('phone_number')
          .eq('is_active', true)
          .single();

        if (config?.phone_number) {
          twilioPhoneNumber = config.phone_number;
          console.log("Using Twilio phone number as callerId:", twilioPhoneNumber);
        } else {
          console.error("No Twilio phone number found in configuration");
        }

        // Guardar en base de datos de forma asíncrona (no bloquear la respuesta)
        (async () => {
          try {
            await supabaseAdmin
              .from('calls')
              .insert({
                call_sid: callSid,
                from_number: fromNumber,
                to_number: toNumber,
                direction: 'outbound',
                status: 'in-progress',
                user_id: userId || null,
              });

            console.log("Call saved to database");
          } catch (dbError) {
            console.error("Error saving to database (non-blocking):", dbError);
          }
        })();
      } catch (error) {
        console.error("Error getting Twilio configuration:", error);
      }

      // Responder inmediatamente con TwiML (sin esperar la base de datos)
      // IMPORTANTE: Incluir callerId para evitar warning 13214
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-status-callback`;
      const recordingCallbackUrl = `${supabaseUrl}/functions/v1/twilio-recording-callback`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30" record="record-from-answer" callerId="${twilioPhoneNumber}" recordingStatusCallback="${recordingCallbackUrl}" recordingStatusCallbackEvent="completed">
    <Number statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated ringing answered completed">${toNumber}</Number>
  </Dial>
</Response>`;

      console.log("Returning TwiML for outbound call");

      return new Response(twiml, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/xml",
        },
      });
    }

    // Fallback: llamada regular (no desde cliente web)
    console.log("Regular call flow - inbound or other");

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lupe" language="es-MX">Bienvenido.</Say>
  <Hangup/>
</Response>`;

    return new Response(twiml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/xml",
      },
    });

  } catch (error: any) {
    console.error("Error in twilio-voice-webhook:", error);
    console.error("Error stack:", error.stack);

    // Siempre devolver TwiML válido, incluso en caso de error
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