import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendCampaignRequest {
  campaign_id: string;
  contact_ids?: string[];
  retry_failed?: boolean;
}

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

    const { campaign_id, contact_ids, retry_failed }: SendCampaignRequest = await req.json();

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id es requerido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*, email_templates(*)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campaña no encontrada" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: smtpSettings } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "smtp_config")
      .single();

    if (!smtpSettings || !smtpSettings.setting_value) {
      return new Response(
        JSON.stringify({ error: "Configuración SMTP no encontrada" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const smtp = smtpSettings.setting_value as any;

    if (!smtp.host || !smtp.username || !smtp.password) {
      return new Response(
        JSON.stringify({ error: "Configuración SMTP incompleta" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let contacts;
    if (retry_failed) {
      const { data: failedLogs } = await supabase
        .from("campaign_email_logs")
        .select("email, contact_id")
        .eq("campaign_id", campaign_id)
        .eq("status", "failed");

      if (failedLogs && failedLogs.length > 0) {
        const failedContactIds = failedLogs
          .map(log => log.contact_id)
          .filter(id => id !== null);

        if (failedContactIds.length > 0) {
          const { data } = await supabase
            .from("contacts")
            .select("*")
            .in("id", failedContactIds);
          contacts = data;
        } else {
          contacts = failedLogs.map(log => ({
            id: null,
            email: log.email,
            name: log.email.split('@')[0]
          }));
        }
      } else {
        contacts = [];
      }
    } else if (contact_ids && contact_ids.length > 0) {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .in("id", contact_ids);
      contacts = data;
    } else if (campaign.group_id) {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("group_id", campaign.group_id)
        .eq("status", "active");
      contacts = data;
    } else {
      contacts = [];
    }

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay contactos para enviar" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (retry_failed) {
      await supabase
        .from("campaigns")
        .update({ status: "sending" })
        .eq("id", campaign_id);

      await supabase
        .from("campaign_email_logs")
        .update({ status: "pending", error_message: null })
        .eq("campaign_id", campaign_id)
        .eq("status", "failed");
    } else {
      await supabase
        .from("campaigns")
        .update({
          status: "sending",
          total_recipients: contacts.length,
          sent_count: 0,
          failed_count: 0,
        })
        .eq("id", campaign_id);

      const initialLogs = contacts.map((contact: any) => ({
        campaign_id,
        contact_id: contact.id,
        email: contact.email,
        status: "pending",
      }));

      await supabase.from("campaign_email_logs").insert(initialLogs);
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    });

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const contact of contacts) {
      try {
        if (retry_failed) {
          await supabase
            .from("campaign_email_logs")
            .update({ status: "sending" })
            .eq("campaign_id", campaign_id)
            .eq("email", contact.email);
        } else {
          await supabase
            .from("campaign_email_logs")
            .update({ status: "sending" })
            .eq("campaign_id", campaign_id)
            .eq("contact_id", contact.id);
        }

        let htmlContent = campaign.email_templates.html_body;
        let subjectContent = campaign.email_templates.subject;

        const variables = {
          client_name: `${contact.first_name || ""} ${contact.last_name || ""}`.trim() || "Cliente",
          client_email: contact.email,
          company_name: contact.company_name || "",
          current_date: new Date().toLocaleDateString("es-MX"),
          crm_company: smtp.from_name || "CRM Pro",
        };

        Object.keys(variables).forEach((key) => {
          const regex = new RegExp(`{{${key}}}`, "g");
          htmlContent = htmlContent.replace(regex, variables[key as keyof typeof variables]);
          subjectContent = subjectContent.replace(regex, variables[key as keyof typeof variables]);
        });

        const info = await transporter.sendMail({
          from: `"${smtp.from_name}" <${smtp.from_email}>`,
          to: contact.email,
          subject: subjectContent,
          html: htmlContent,
        });

        if (retry_failed) {
          await supabase
            .from("campaign_email_logs")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              metadata: {
                messageId: info.messageId,
                response: info.response,
              },
            })
            .eq("campaign_id", campaign_id)
            .eq("email", contact.email);
        } else {
          await supabase
            .from("campaign_email_logs")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              metadata: {
                messageId: info.messageId,
                response: info.response,
              },
            })
            .eq("campaign_id", campaign_id)
            .eq("contact_id", contact.id);
        }

        results.sent++;

        await supabase
          .from("campaigns")
          .update({ sent_count: results.sent })
          .eq("id", campaign_id);

      } catch (error: any) {
        console.error(`Error enviando a ${contact.email}:`, error);
        results.failed++;
        results.errors.push(`${contact.email}: ${error.message}`);

        if (retry_failed) {
          await supabase
            .from("campaign_email_logs")
            .update({
              status: "failed",
              error_message: error.message,
              metadata: { error: error.toString() },
            })
            .eq("campaign_id", campaign_id)
            .eq("email", contact.email);
        } else {
          await supabase
            .from("campaign_email_logs")
            .update({
              status: "failed",
              error_message: error.message,
              metadata: { error: error.toString() },
            })
            .eq("campaign_id", campaign_id)
            .eq("contact_id", contact.id);
        }

        await supabase
          .from("campaigns")
          .update({ failed_count: results.failed })
          .eq("id", campaign_id);
      }
    }

    await supabase
      .from("campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_count: results.sent,
        failed_count: results.failed,
      })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Enviados: ${results.sent}, Fallidos: ${results.failed}`,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error en send-campaign-emails:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno del servidor" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});