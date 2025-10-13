import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-User-Id",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('=== CONNECT CALL REQUEST ===');

    const userIdHeader = req.headers.get('x-user-id');
    const body = await req.json();
    const { callSid, userId } = body;
    
    const finalUserId = userId || userIdHeader;

    if (!finalUserId) {
      console.error('No user ID provided');
      throw new Error('User ID is required');
    }

    if (!callSid) {
      throw new Error('Call SID is required');
    }

    console.log('Connecting call for user:', finalUserId);
    console.log('Call SID:', callSid);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: config } = await supabaseAdmin
      .from('twilio_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();

    if (!config) {
      throw new Error('Twilio configuration not found');
    }

    const accountSid = config.account_sid;
    const authToken = config.auth_token;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-inbound-webhook`;

    const identity = `agent_${finalUserId}`;
    console.log('Connecting to client identity:', identity);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Lupe" language="es-MX">Conectando con un agente.</Say>
  <Dial timeout="30" record="record-from-answer" recordingStatusCallback="${statusCallbackUrl}" recordingStatusCallbackMethod="POST">
    <Client>${identity}</Client>
  </Dial>
  <Say voice="Polly.Lupe" language="es-MX">El agente no está disponible. Por favor intente más tarde.</Say>
</Response>`;

    console.log('Generated TwiML:', twiml);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;
    
    const credentials = btoa(`${accountSid}:${authToken}`);
    
    const formData = new URLSearchParams();
    formData.append('Twiml', twiml);

    console.log('Updating call with Twilio API...');

    const twilioResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error('Twilio API error:', errorText);
      throw new Error(`Failed to connect call: ${twilioResponse.status}`);
    }

    const result = await twilioResponse.json();
    console.log('Twilio API response:', result);

    await supabaseAdmin
      .from('incoming_calls')
      .update({ status: 'answered' })
      .eq('call_sid', callSid);

    console.log('Call connected successfully');

    return new Response(
      JSON.stringify({ success: true, call: result }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error connecting call:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});