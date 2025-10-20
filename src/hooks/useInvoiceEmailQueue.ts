import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useInvoiceEmailQueue() {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const processingRef = useRef(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const processFunction = async () => {
      if (processingRef.current) {
        console.log('⏸️ Procesamiento de emails ya en curso, saltando...');
        return;
      }

      processingRef.current = true;

      try {
        console.log('🔍 Verificando facturas pendientes de envío por email...');

        const { data: pendingEmails } = await supabase
          .from('invoice_email_queue')
          .select('id, invoice_id')
          .eq('status', 'pending')
          .limit(5);

        if (pendingEmails && pendingEmails.length > 0) {
          console.log(`📧 Encontradas ${pendingEmails.length} facturas pendientes de envío, procesando...`);

          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-invoice-email-queue`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const result = await response.json();
            console.log('✅ Emails procesados:', result);
            if (result.failed > 0) {
              console.warn('⚠️ Algunos emails fallaron, revisa las observaciones de las facturas');
            }
          } else {
            const errorText = await response.text();
            console.error('❌ Error procesando emails:', errorText);
          }
        } else {
          console.log('✅ No hay facturas pendientes de envío');
        }
      } catch (error) {
        console.error('❌ Error en procesamiento automático de emails:', error);
      } finally {
        processingRef.current = false;
      }
    };

    // Procesar al inicio
    processFunction();

    // Procesar cada 30 segundos (polling para asegurar que se procese)
    intervalRef.current = window.setInterval(() => {
      processFunction();
    }, 30000);

    console.log('👂 Iniciando escucha de cola de emails...');

    // Escuchar cambios en la cola
    channelRef.current = supabase
      .channel('invoice-email-queue-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invoice_email_queue',
          filter: 'status=eq.pending',
        },
        (payload) => {
          console.log('🔔 Nueva factura en cola de emails:', payload);
          setTimeout(() => processFunction(), 1000);
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado de suscripción de cola de emails:', status);
      });

    return () => {
      console.log('🛑 Cerrando suscripción de cola de emails...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
