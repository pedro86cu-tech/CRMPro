import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.7";
import { jsPDF } from "npm:jspdf@2.5.2";

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

    const { data: generalSettings } = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "general_settings")
      .single();

    const settings = generalSettings?.setting_value || {};
    const timezone = settings.timezone || 'America/Montevideo';
    const dateFormat = settings.date_format || 'DD/MM/YYYY';
    const currency = settings.currency || 'USD';

    const formatCurrency = (amount: number, curr: string = currency) => {
      return new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: curr,
        minimumFractionDigits: 2
      }).format(amount);
    };

    const formatDate = (date: string) => {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();

      if (dateFormat === 'MM/DD/YYYY') {
        return `${month}/${day}/${year}`;
      } else if (dateFormat === 'YYYY-MM-DD') {
        return `${year}-${month}-${day}`;
      } else {
        return `${day}/${month}/${year}`;
      }
    };

    const companyInfo = {
      name: settings.company_name || "Mi Empresa",
      rut: settings.company_rut || "000000000",
      address: settings.company_address || "Dirección no configurada",
      city: settings.company_city || "Montevideo",
      country: settings.company_country || "Uruguay",
      phone: settings.company_phone || "+598 00 000 000",
      email: settings.company_email || smtp.username,
      web: settings.company_website || "www.miempresa.com"
    };

    const subtotalTax22 = Number(invoice.subtotal) || 0;
    const tax22 = Number(invoice.tax_amount) || 0;
    const discount = Number(invoice.discount_amount) || 0;
    const total = Number(invoice.total_amount) || 0;

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo.name, 20, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`RUT: ${companyInfo.rut}`, 20, 27);
    doc.text(`${companyInfo.address}`, 20, 32);
    doc.text(`${companyInfo.city}, ${companyInfo.country}`, 20, 37);
    doc.text(`Tel: ${companyInfo.phone}`, 20, 42);
    doc.text(`Email: ${companyInfo.email}`, 20, 47);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURA ELECTRÓNICA', 140, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nº: ${invoice.invoice_number}`, 140, 27);
    doc.text(`Fecha: ${formatDate(invoice.issue_date)}`, 140, 32);
    doc.text(`Vencimiento: ${formatDate(invoice.due_date)}`, 140, 37);
    doc.text(`Moneda: ${order?.currency || currency}`, 140, 42);

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 52, 190, 52);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE', 20, 60);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(client.contact_name, 20, 67);
    if (client.company_name) {
      doc.text(client.company_name, 20, 72);
    }
    if (client.address) {
      doc.text(client.address, 20, client.company_name ? 77 : 72);
    }
    doc.text(`Email: ${client.email}`, 20, client.company_name ? 82 : 77);
    if (client.phone) {
      doc.text(`Tel: ${client.phone}`, 20, client.company_name ? 87 : 82);
    }

    let yPosition = 100;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(249, 250, 251);
    doc.rect(20, yPosition, 170, 8, 'F');
    doc.text('Código', 22, yPosition + 5);
    doc.text('Descripción', 45, yPosition + 5);
    doc.text('Cant', 100, yPosition + 5);
    doc.text('P.Unit', 115, yPosition + 5);
    doc.text('Desc%', 135, yPosition + 5);
    doc.text('IVA%', 155, yPosition + 5);
    doc.text('Total', 175, yPosition + 5);

    yPosition += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    (invoiceItems || []).forEach((item: any) => {
      const itemSubtotal = Number(item.quantity) * Number(item.unit_price);
      const itemDiscount = itemSubtotal * (Number(item.discount) / 100);
      const itemAfterDiscount = itemSubtotal - itemDiscount;
      const itemTax = itemAfterDiscount * (Number(item.tax_rate) / 100);
      const itemTotal = itemAfterDiscount + itemTax;

      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      doc.text(item.code || 'N/A', 22, yPosition);
      doc.text(item.description.substring(0, 25), 45, yPosition);
      doc.text(String(item.quantity), 100, yPosition);
      doc.text(formatCurrency(Number(item.unit_price), order?.currency || currency), 115, yPosition);
      doc.text(`${item.discount}%`, 135, yPosition);
      doc.text(`${item.tax_rate}%`, 155, yPosition);
      doc.text(formatCurrency(itemTotal, order?.currency || currency), 165, yPosition, { align: 'right' });

      yPosition += 7;
    });

    yPosition += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(120, yPosition, 190, yPosition);

    yPosition += 7;
    doc.setFontSize(9);
    doc.text('Subtotal:', 125, yPosition);
    doc.text(formatCurrency(subtotalTax22, order?.currency || currency), 185, yPosition, { align: 'right' });

    yPosition += 6;
    doc.text('Descuentos:', 125, yPosition);
    doc.text(`-${formatCurrency(discount, order?.currency || currency)}`, 185, yPosition, { align: 'right' });

    yPosition += 6;
    doc.text('IVA:', 125, yPosition);
    doc.text(formatCurrency(tax22, order?.currency || currency), 185, yPosition, { align: 'right' });

    yPosition += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TOTAL:', 125, yPosition);
    doc.text(formatCurrency(total, order?.currency || currency), 185, yPosition, { align: 'right' });

    if (invoice.notes) {
      yPosition += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Observaciones:', 20, yPosition);
      yPosition += 5;
      const splitNotes = doc.splitTextToSize(invoice.notes, 170);
      doc.text(splitNotes, 20, yPosition);
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${companyInfo.name} · RUT ${companyInfo.rut} · ${companyInfo.address} · ${companyInfo.city}, ${companyInfo.country}`, 105, 285, { align: 'center' });
    doc.text(`Tel: ${companyInfo.phone} · Email: ${companyInfo.email} · Web: ${companyInfo.web}`, 105, 290, { align: 'center' });

    const pdfBuffer = doc.output('arraybuffer');

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
      El total de la factura asciende a <strong>${formatCurrency(total, order?.currency || currency)}</strong>.
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
          content: new Uint8Array(pdfBuffer),
          contentType: 'application/pdf'
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