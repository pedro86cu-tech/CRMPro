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
      web: settings.company_website || "www.miempresa.com",
      logo_url: settings.company_logo_url || ""
    };

    const subtotalTax22 = Number(invoice.subtotal) || 0;
    const tax22 = Number(invoice.tax_amount) || 0;
    const discount = Number(invoice.discount_amount) || 0;
    const total = Number(invoice.total_amount) || 0;

    const doc = new jsPDF();

    let logoYOffset = 0;
    if (companyInfo.logo_url) {
      try {
        const logoResponse = await fetch(companyInfo.logo_url);
        const logoBlob = await logoResponse.blob();
        const logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        doc.addImage(logoBase64, 'PNG', 20, 28, 30, 30);
        logoYOffset = 48;
      } catch (e) {
        logoYOffset = 0;
      }
    }

    const startY = logoYOffset || 25;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(72, 156, 156);
    doc.text(companyInfo.name, logoYOffset ? 55 : 20, startY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`RUT: ${companyInfo.rut}`, logoYOffset ? 55 : 20, startY + 7);
    doc.text(`${companyInfo.address}`, logoYOffset ? 55 : 20, startY + 12);
    doc.text(`${companyInfo.city}, ${companyInfo.country}`, logoYOffset ? 55 : 20, startY + 17);
    doc.text(`Tel: ${companyInfo.phone}`, logoYOffset ? 55 : 20, startY + 22);
    doc.text(`Email: ${companyInfo.email}`, logoYOffset ? 55 : 20, startY + 27);

    doc.setFillColor(72, 156, 156);
    doc.rect(140, startY - 5, 50, 12, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('FACTURA', 165, startY + 2, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Nº: ${invoice.invoice_number}`, 140, startY + 12);
    doc.text(`Fecha: ${formatDate(invoice.issue_date)}`, 140, startY + 17);
    doc.text(`Vencimiento: ${formatDate(invoice.due_date)}`, 140, startY + 22);
    doc.text(`Moneda: ${order?.currency || currency}`, 140, startY + 27);

    const lineY = Math.max(58, startY + 40);
    doc.setDrawColor(72, 156, 156);
    doc.setLineWidth(0.5);
    doc.line(20, lineY, 190, lineY);

    const clientY = lineY + 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(72, 156, 156);
    doc.text('CLIENTE', 20, clientY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(client.contact_name, 20, clientY + 7);
    if (client.company_name) {
      doc.text(client.company_name, 20, clientY + 12);
    }
    if (client.address) {
      doc.text(client.address, 20, client.company_name ? clientY + 17 : clientY + 12);
    }
    doc.text(`Email: ${client.email}`, 20, client.company_name ? clientY + 22 : clientY + 17);
    if (client.phone) {
      doc.text(`Tel: ${client.phone}`, 20, client.company_name ? clientY + 27 : clientY + 22);
    }

    let yPosition = clientY + 40;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(72, 156, 156);
    doc.rect(20, yPosition, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('Descripción', 22, yPosition + 5);
    doc.text('Cant', 115, yPosition + 5);
    doc.text('P.Unit', 135, yPosition + 5);
    doc.text('Desc%', 155, yPosition + 5);
    doc.text('Total', 175, yPosition + 5);

    yPosition += 13;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    const formatPrice = (amount: number, curr: string = currency) => {
      return new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: curr,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    };

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

      doc.text(item.description.substring(0, 50), 22, yPosition);
      doc.text(String(item.quantity), 115, yPosition);
      doc.text(formatPrice(Number(item.unit_price), order?.currency || currency), 135, yPosition);
      doc.text(`${item.discount}%`, 155, yPosition);
      doc.text(formatPrice(itemTotal, order?.currency || currency), 185, yPosition, { align: 'right' });

      yPosition += 7;
    });

    yPosition += 10;
    doc.setDrawColor(72, 156, 156);
    doc.setLineWidth(0.5);
    doc.line(120, yPosition, 190, yPosition);

    yPosition += 7;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text('Subtotal:', 125, yPosition);
    doc.text(formatPrice(subtotalTax22, order?.currency || currency), 185, yPosition, { align: 'right' });

    yPosition += 6;
    doc.text('Descuentos:', 125, yPosition);
    doc.text(`-${formatPrice(discount, order?.currency || currency)}`, 185, yPosition, { align: 'right' });

    yPosition += 6;
    doc.text('IVA:', 125, yPosition);
    doc.text(formatPrice(tax22, order?.currency || currency), 185, yPosition, { align: 'right' });

    yPosition += 10;
    doc.setFillColor(72, 156, 156);
    doc.rect(120, yPosition - 6, 70, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL:', 125, yPosition);
    doc.text(formatPrice(total, order?.currency || currency), 185, yPosition, { align: 'right' });

    doc.setDrawColor(72, 156, 156);
    doc.setLineWidth(0.5);
    doc.line(20, 280, 190, 280);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(72, 156, 156);
    doc.text(`${companyInfo.name} · RUT ${companyInfo.rut}`, 105, 285, { align: 'center' });
    doc.text(`${companyInfo.address} · ${companyInfo.city}, ${companyInfo.country}`, 105, 289, { align: 'center' });
    doc.text(`Tel: ${companyInfo.phone} · Email: ${companyInfo.email} · Web: ${companyInfo.web}`, 105, 293, { align: 'center' });

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