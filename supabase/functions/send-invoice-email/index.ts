import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendInvoiceRequest {
  invoice_id: string;
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

    const { invoice_id }: SendInvoiceRequest = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id es requerido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        clients (*),
        orders (*)
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Factura no encontrada" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!invoice.clients || !invoice.clients.email) {
      return new Response(
        JSON.stringify({ error: "Cliente no tiene email configurado" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invoiceItems } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoice_id);

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

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.port === 465,
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    });

    const client = invoice.clients;
    const order = invoice.orders;

    const formatCurrency = (amount: number, currency: string = "USD") => {
      return new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
      }).format(amount);
    };

    const formatDate = (date: string) => {
      return new Date(date).toLocaleDateString('es-UY', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    const { data: companySettings } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "company_info")
      .single();

    const companyInfo = companySettings?.setting_value || {
      name: "Mi Empresa",
      rut: "000000000",
      address: "Dirección no configurada",
      city: "Montevideo",
      country: "Uruguay",
      phone: "+598 00 000 000",
      email: smtp.username,
      web: "www.miempresa.com"
    };

    const itemsHtml = (invoiceItems || []).map((item: any) => {
      const itemSubtotal = Number(item.quantity) * Number(item.unit_price);
      const itemDiscount = itemSubtotal * (Number(item.discount) / 100);
      const itemAfterDiscount = itemSubtotal - itemDiscount;
      const itemTax = itemAfterDiscount * (Number(item.tax_rate) / 100);
      const itemTotal = itemAfterDiscount + itemTax;

      return `
        <tr>
          <td>${item.description}</td>
          <td>${item.description}</td>
          <td class="right">${item.quantity}</td>
          <td class="right">${formatCurrency(Number(item.unit_price), order?.currency || 'USD')}</td>
          <td class="right">${item.discount}%</td>
          <td class="right">${item.tax_rate}%</td>
          <td class="right">${formatCurrency(itemTotal, order?.currency || 'USD')}</td>
        </tr>
      `;
    }).join('');

    const subtotalTax22 = Number(invoice.subtotal) || 0;
    const tax22 = Number(invoice.tax_amount) || 0;
    const discount = Number(invoice.discount_amount) || 0;
    const total = Number(invoice.total_amount) || 0;

    const invoicePdfHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>Factura ${invoice.invoice_number}</title>
<style>
  body{margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827}
  .wrapper{width:100%;padding:16px 0}
  .container{max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb}
  .px{padding-left:24px;padding-right:24px}
  .pt{padding-top:20px}.pb{padding-bottom:20px}
  .muted{color:#6b7280;font-size:12px}
  .tag{display:inline-block;padding:2px 8px;border:1px solid #1f2937;border-radius:4px;font-size:12px;font-weight:bold}
  .h1{font-size:18px;font-weight:700;margin:0}
  .h2{font-size:14px;font-weight:700;margin:0}
  .row{display:flex;gap:16px;flex-wrap:wrap}
  .col{flex:1 1 0}
  table{width:100%;border-collapse:collapse}
  th,td{padding:8px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  th{background:#f9fafb;text-align:left;font-size:12px;color:#374151}
  td{font-size:13px}
  .right{text-align:right}
  .center{text-align:center}
  .totals td{border:none;padding:6px 8px}
  .badge{font-size:12px;color:#10b981;font-weight:700}
  .note{background:#f9fafb;border:1px dashed #d1d5db;padding:10px;font-size:12px;color:#374151}
  .footer{font-size:11px;color:#6b7280;line-height:1.4}
  @media print{
    body{background:#fff}
    .container{border:none;max-width:800px}
  }
</style>
</head>
<body>
<div class="wrapper">
  <div class="container">
    <div class="px pt">
      <div class="row">
        <div class="col" style="min-width:220px">
          <p style="margin:6px 0 0" class="muted">
            <span class="h2">${companyInfo.name}</span><br>
            RUT: ${companyInfo.rut}<br>
            ${companyInfo.address}<br>
            Tel: ${companyInfo.phone} · Email: ${companyInfo.email}
          </p>
        </div>
        <div class="col right" style="min-width:200px">
          <div class="tag">FACTURA ELECTRÓNICA</div>
          <p class="h1" style="margin-top:8px">Nº: ${invoice.invoice_number}</p>
          <p class="muted" style="margin:6px 0 0">
            Fecha emisión: ${formatDate(invoice.issue_date)}<br>
            Moneda: ${order?.currency || 'USD'}
          </p>
        </div>
      </div>
    </div>

    <div class="px">
      <div class="row" style="margin-top:10px">
        <div class="col" style="min-width:260px">
          <p class="h2">Cliente</p>
          <p style="margin:6px 0 0;font-size:13px">
            ${client.contact_name}${client.company_name ? ' - ' + client.company_name : ''}<br>
            ${client.address || ''}<br>
            ${client.city ? client.city + ', ' : ''}${client.country || ''}<br>
            Email: ${client.email} · Tel: ${client.phone || 'N/A'}
          </p>
        </div>
        <div class="col" style="min-width:220px">
          <p class="h2">Condiciones</p>
          <p style="margin:6px 0 0;font-size:13px">
            Forma de pago: ${order?.payment_method || 'N/A'}<br>
            Vencimiento: ${formatDate(invoice.due_date)}<br>
            Términos: ${order?.payment_terms || 'Contado'}
          </p>
        </div>
      </div>
    </div>

    <div class="px pt">
      <table role="table" aria-label="Detalle">
        <thead>
          <tr>
            <th style="width:16%">Código</th>
            <th>Descripción</th>
            <th class="right" style="width:12%">Cant.</th>
            <th class="right" style="width:16%">P. Unit.</th>
            <th class="right" style="width:12%">Desc.</th>
            <th class="right" style="width:12%">IVA %</th>
            <th class="right" style="width:18%">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>

    <div class="px pt">
      <div class="row">
        <div class="col" style="min-width:260px">
          <div class="note">
            <strong>Observaciones:</strong><br>
            ${invoice.notes || 'N/A'}
          </div>
          <p class="muted" style="margin:10px 0 0">
            Precios expresados en ${order?.currency || 'USD'}.
          </p>
        </div>
        <div class="col" style="min-width:220px">
          <table class="totals" aria-label="Totales" style="width:100%">
            <tr><td class="right">Sub-total:</td><td class="right" style="width:34%">${formatCurrency(subtotalTax22, order?.currency || 'USD')}</td></tr>
            <tr><td class="right">Descuentos:</td><td class="right">-${formatCurrency(discount, order?.currency || 'USD')}</td></tr>
            <tr><td class="right">IVA:</td><td class="right">${formatCurrency(tax22, order?.currency || 'USD')}</td></tr>
            <tr><td class="right"><strong>Total:</strong></td><td class="right"><strong>${formatCurrency(total, order?.currency || 'USD')}</strong></td></tr>
          </table>
        </div>
      </div>
    </div>

    <div class="px pb">
      <hr style="border:none;border-top:1px solid #e5e7eb">
      <p class="footer">
        ${companyInfo.name} · RUT ${companyInfo.rut} · ${companyInfo.address} · ${companyInfo.city}, ${companyInfo.country}<br>
        Atención al cliente: ${companyInfo.phone} · ${companyInfo.email} · ${companyInfo.web}
      </p>
    </div>
  </div>
</div>
</body>
</html>`;

    const emailHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Factura electrónica ${invoice.invoice_number}</title>
<style>
  body {
    background-color:#f9fafb;
    font-family: Arial, Helvetica, sans-serif;
    color:#111827;
    margin:0;
    padding:0;
  }
  .container {
    max-width:600px;
    margin:40px auto;
    background:#ffffff;
    border:1px solid #e5e7eb;
    border-radius:8px;
    padding:24px;
  }
  .header {
    text-align:center;
    border-bottom:1px solid #e5e7eb;
    padding-bottom:12px;
  }
  h1 {
    font-size:18px;
    margin:12px 0;
    color:#1f2937;
  }
  p {
    font-size:14px;
    line-height:1.6;
  }
  .cta {
    display:inline-block;
    background-color:#2563eb;
    color:#fff;
    text-decoration:none;
    padding:10px 18px;
    border-radius:6px;
    margin-top:20px;
  }
  .footer {
    margin-top:30px;
    font-size:12px;
    color:#6b7280;
    text-align:center;
    border-top:1px solid #e5e7eb;
    padding-top:12px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Factura electrónica emitida</h1>
    </div>
    
    <p>Estimado/a <strong>${client.contact_name}</strong>,</p>
    
    <p>
      Le informamos que su <strong>Factura</strong> N.º <strong>${invoice.invoice_number}</strong>
      ha sido emitida con fecha <strong>${formatDate(invoice.issue_date)}</strong> por 
      <strong>${companyInfo.name}</strong>.
    </p>

    <p>
      El total de la factura asciende a <strong>${formatCurrency(total, order?.currency || 'USD')}</strong>.
    </p>

    <p>
      Encontrará adjunto el archivo PDF correspondiente para su registro.
    </p>

    <p style="font-size:13px;color:#374151;">
      Si ya realizó el pago, no es necesario realizar ninguna acción adicional.  
      En caso contrario, le recordamos que la fecha de vencimiento es el <strong>${formatDate(invoice.due_date)}</strong>.
    </p>

    <div class="footer">
      ${companyInfo.name} · RUT ${companyInfo.rut}<br>
      ${companyInfo.address} · ${companyInfo.city}, ${companyInfo.country}<br>
      Tel: ${companyInfo.phone} · Email: ${companyInfo.email}<br>
      <a href="${companyInfo.web}" style="color:#2563eb;text-decoration:none;">${companyInfo.web}</a>
    </div>
  </div>
</body>
</html>`;

    const mailOptions = {
      from: `"${companyInfo.name}" <${smtp.username}>`,
      to: client.email,
      subject: `Factura ${invoice.invoice_number} - ${companyInfo.name}`,
      html: emailHtml,
      attachments: [
        {
          filename: `Factura_${invoice.invoice_number}.pdf`,
          content: invoicePdfHtml,
          contentType: 'text/html'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoice_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Factura enviada a ${client.email}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error enviando factura:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});