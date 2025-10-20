import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ValidateInvoiceRequest {
  invoice_id: string;
  config_id?: string;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

function processMapping(mapping: any, context: any): any {
  const result: any = {};

  for (const [targetKey, sourceConfig] of Object.entries(mapping)) {
    if (typeof sourceConfig === 'string') {
      const value = getNestedValue(context, sourceConfig);
      setNestedValue(result, targetKey, value);
    } else if (typeof sourceConfig === 'object' && sourceConfig !== null) {
      if (sourceConfig._type === 'array' && sourceConfig._source && sourceConfig._mapping) {
        const sourceArray = getNestedValue(context, sourceConfig._source);
        if (Array.isArray(sourceArray)) {
          const mappedArray = sourceArray.map((item: any) => {
            const mappedItem: any = {};
            for (const [itemKey, itemPath] of Object.entries(sourceConfig._mapping)) {
              const itemValue = getNestedValue({ item }, `item.${itemPath}`);
              mappedItem[itemKey] = itemValue;
            }
            return mappedItem;
          });
          setNestedValue(result, targetKey, mappedArray);
        }
      } else if (sourceConfig._type === 'object' && sourceConfig._mapping) {
        const mappedObject = processMapping(sourceConfig._mapping, context);
        setNestedValue(result, targetKey, mappedObject);
      } else {
        const value = getNestedValue(context, sourceConfig as string);
        setNestedValue(result, targetKey, value);
      }
    }
  }

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { invoice_id, config_id }: ValidateInvoiceRequest = await req.json();

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

    const { data: orderItems } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", invoice.order_id);

    let configQuery = supabase
      .from("external_invoice_api_config")
      .select("*")
      .eq("is_active", true);

    if (config_id) {
      configQuery = configQuery.eq("id", config_id);
    }

    const { data: configs, error: configError } = await configQuery;

    if (configError || !configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay configuración activa disponible" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const config = configs[0];

    const context = {
      invoice,
      client: invoice.clients,
      order: invoice.orders,
      items: orderItems || []
    };

    const requestMapping = config.request_mapping as any;
    const requestPayload = processMapping(requestMapping, context);

    console.log("Request payload:", JSON.stringify(requestPayload, null, 2));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
          const variablePath = value.slice(2, -2).trim();
          const resolvedValue = getNestedValue(context, variablePath);
          headers[key] = String(resolvedValue || '');
        } else {
          headers[key] = String(value);
        }
      }
    }

    const authCreds = config.auth_credentials as any;

    if (config.auth_type === "basic" && authCreds.username && authCreds.password) {
      const encoded = btoa(`${authCreds.username}:${authCreds.password}`);
      headers["Authorization"] = `Basic ${encoded}`;
    } else if (config.auth_type === "bearer" && authCreds.token) {
      headers["Authorization"] = `Bearer ${authCreds.token}`;
    } else if (config.auth_type === "api_key" && authCreds.key && authCreds.value) {
      headers[authCreds.key] = authCreds.value;
    }

    let responsePayload: any = null;
    let statusCode = 0;
    let status = "pending";
    let errorMessage: string | null = null;
    let validationResult = "pending";
    let externalReference: string | null = null;
    let retryCount = 0;

    const maxRetries = config.retry_attempts || 3;
    const timeout = config.timeout || 30000;

    while (retryCount <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(config.api_url, {
          method: "POST",
          headers,
          body: JSON.stringify(requestPayload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        statusCode = response.status;
        responsePayload = await response.json();

        console.log("Response:", JSON.stringify(responsePayload, null, 2));

        if (response.ok) {
          status = "success";

          const responseMapping = config.response_mapping as any;

          if (responseMapping.approved) {
            const approvedValue = getNestedValue({ response: responsePayload }, responseMapping.approved);
            validationResult = approvedValue ? "approved" : "rejected";
          }

          if (responseMapping.reference) {
            externalReference = getNestedValue({ response: responsePayload }, responseMapping.reference);
          }

          if (responseMapping.message) {
            errorMessage = getNestedValue({ response: responsePayload }, responseMapping.message);
          }

          break;
        } else {
          errorMessage = responsePayload.message || `HTTP ${statusCode}`;
          status = "error";
          validationResult = "error";

          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            continue;
          }
        }

        break;
      } catch (error: any) {
        if (error.name === "AbortError") {
          status = "timeout";
          errorMessage = "Request timeout";
          validationResult = "error";
        } else {
          status = "error";
          errorMessage = error.message;
          validationResult = "error";
        }

        if (retryCount < maxRetries) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }

        break;
      }
    }

    const duration = Date.now() - startTime;

    const { data: logEntry, error: logError } = await supabase
      .from("external_invoice_validation_log")
      .insert({
        invoice_id: invoice_id,
        config_id: config.id,
        request_payload: requestPayload,
        response_payload: responsePayload,
        status_code: statusCode,
        status: status,
        error_message: errorMessage,
        validation_result: validationResult,
        external_reference: externalReference,
        duration_ms: duration,
        retry_count: retryCount,
      })
      .select()
      .single();

    if (logError) {
      console.error("Error logging validation:", logError);
    }

    if (validationResult === "approved") {
      const responseMapping = config.response_mapping as any;
      const updateData: any = {
        status: "validated",
        validated_at: new Date().toISOString(),
        validation_response: responsePayload,
        pending_validation: false,
        updated_at: new Date().toISOString()
      };

      if (responseMapping.numero_cfe) {
        const numeroCFE = getNestedValue({ response: responsePayload }, responseMapping.numero_cfe);
        if (numeroCFE) updateData.numero_cfe = numeroCFE;
      }

      if (responseMapping.serie_cfe) {
        const serieCFE = getNestedValue({ response: responsePayload }, responseMapping.serie_cfe);
        if (serieCFE) updateData.serie_cfe = serieCFE;
      }

      if (responseMapping.tipo_cfe) {
        const tipoCFE = getNestedValue({ response: responsePayload }, responseMapping.tipo_cfe);
        if (tipoCFE) updateData.tipo_cfe = tipoCFE;
      }

      if (responseMapping.cae) {
        const cae = getNestedValue({ response: responsePayload }, responseMapping.cae);
        if (cae) updateData.cae = cae;
      }

      if (responseMapping.vencimiento_cae) {
        const vencimientoCAE = getNestedValue({ response: responsePayload }, responseMapping.vencimiento_cae);
        if (vencimientoCAE) updateData.vencimiento_cae = vencimientoCAE;
      }

      if (responseMapping.qr_code) {
        const qrCode = getNestedValue({ response: responsePayload }, responseMapping.qr_code);
        if (qrCode) updateData.qr_code = qrCode;
      }

      if (responseMapping.dgi_estado) {
        const dgiEstado = getNestedValue({ response: responsePayload }, responseMapping.dgi_estado);
        if (dgiEstado) updateData.dgi_estado = dgiEstado;
      }

      if (responseMapping.dgi_codigo_autorizacion) {
        const dgiCodigoAutorizacion = getNestedValue({ response: responsePayload }, responseMapping.dgi_codigo_autorizacion);
        if (dgiCodigoAutorizacion) updateData.dgi_codigo_autorizacion = dgiCodigoAutorizacion;
      }

      if (responseMapping.dgi_mensaje) {
        const dgiMensaje = getNestedValue({ response: responsePayload }, responseMapping.dgi_mensaje);
        if (dgiMensaje) updateData.dgi_mensaje = dgiMensaje;
      }

      if (responseMapping.dgi_id_efactura) {
        const dgiIdEfactura = getNestedValue({ response: responsePayload }, responseMapping.dgi_id_efactura);
        if (dgiIdEfactura) updateData.dgi_id_efactura = dgiIdEfactura;
      }

      if (responseMapping.dgi_fecha_validacion) {
        const dgiFechaValidacion = getNestedValue({ response: responsePayload }, responseMapping.dgi_fecha_validacion);
        if (dgiFechaValidacion) updateData.dgi_fecha_validacion = dgiFechaValidacion;
      }

      console.log("Actualizando factura con datos de validación:", updateData);

      await supabase
        .from("invoices")
        .update(updateData)
        .eq("id", invoice_id);
    }

    return new Response(
      JSON.stringify({
        success: status === "success",
        validation_result: validationResult,
        external_reference: externalReference,
        status: status,
        status_code: statusCode,
        message: errorMessage || "Validación completada",
        duration_ms: duration,
        retry_count: retryCount,
        log_id: logEntry?.id,
        request_payload: requestPayload,
        response_payload: responsePayload,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error validating invoice:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
