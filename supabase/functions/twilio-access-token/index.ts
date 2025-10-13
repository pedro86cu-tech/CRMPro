import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import jwt from "npm:jsonwebtoken@9.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-User-Id"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    console.log("=== TWILIO ACCESS TOKEN REQUEST ===");

    let userId = req.headers.get("x-user-id") ?? undefined;
    if (!userId) {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body.userId === "string") userId = body.userId;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRole) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    const { data: cfg, error: cfgErr } = await supabase
      .from("twilio_config")
      .select("account_sid, api_key_sid, api_key_secret, twiml_app_sid, is_active")
      .eq("is_active", true)
      .maybeSingle();

    if (cfgErr) throw cfgErr;
    if (!cfg) throw new Error("Twilio configuration not found");

    const accountSid = cfg.account_sid?.trim();
    const apiKeySid = cfg.api_key_sid?.trim();
    const apiSecret = (cfg.api_key_secret ?? "").trim();
    const twimlAppSid = cfg.twiml_app_sid?.trim();

    // Validaciones estrictas
    if (!accountSid?.startsWith("AC")) {
      throw new Error("Invalid account_sid (must start with AC)");
    }
    if (!apiKeySid?.startsWith("SK")) {
      throw new Error("Invalid api_key_sid (must start with SK)");
    }
    if (!twimlAppSid?.startsWith("AP")) {
      throw new Error("Invalid twiml_app_sid (must start with AP)");
    }
    if (!apiSecret || apiSecret.length < 16) {
      throw new Error("api_key_secret looks invalid (ensure it's the API Key Secret of the SK, not the Account Auth Token)");
    }

    const identity = `agent_${userId}`;
    const now = Math.floor(Date.now() / 1000);

    const payload = {
      jti: `${apiKeySid}-${now}`,
      grants: {
        identity,
        voice: {
          incoming: { allow: true },
          outgoing: { application_sid: twimlAppSid }
        }
      }
    };

    const header = {
      cty: "twilio-fpa;v=1",
      typ: "JWT"
    };

    const token = jwt.sign(payload, apiSecret, {
      algorithm: "HS256",
      header,
      issuer: apiKeySid,
      subject: accountSid,
      expiresIn: 60 * 60
    });

    // Verificación local para debug
    try {
      jwt.verify(token, apiSecret, {
        algorithms: ["HS256"],
        issuer: apiKeySid,
        subject: accountSid,
        clockTolerance: 5
      });
      console.log("✓ Token verified locally");
    } catch (e) {
      console.error("✗ Local verify failed:", e);
    }

    console.log("Token generated:", {
      iss: apiKeySid.substring(0, 6) + "...",
      sub: accountSid.substring(0, 6) + "...",
      app: twimlAppSid.substring(0, 6) + "...",
      identity
    });

    return new Response(JSON.stringify({ token, identity }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Error generating token:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
