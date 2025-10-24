import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useInvoicePdfQueue() {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const processingRef = useRef(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const processFunction = async () => {
      if (processingRef.current) {
        console.log('⏸️ Procesamiento de PDFs ya en curso, saltando...');
        return;
      }

      processingRef.current = true;

      try {
        console.log('🔍 Verificando facturas pendientes de envío de PDF...');

        const { data: pendingPdfs } = await supabase
          .from('invoice_pdf_queue')
          .select('id, invoice_id, config_id')
          .eq('status', 'pending')
          .limit(5);

        if (pendingPdfs && pendingPdfs.length > 0) {
          console.log(`📄 Encontradas ${pendingPdfs.length} facturas pendientes de envío de PDF, procesando...`);

          for (const pdfJob of pendingPdfs) {
            await supabase
              .from('invoice_pdf_queue')
              .update({ status: 'processing' })
              .eq('id', pdfJob.id);

            const { data, error } = await supabase.functions.invoke('send-invoice-pdf', {
              body: {
                invoice_id: pdfJob.invoice_id,
                config_id: pdfJob.config_id,
              },
            });

            if (error) {
              console.error('❌ Error enviando PDF:', error);
              await supabase
                .from('invoice_pdf_queue')
                .update({
                  status: 'failed',
                  last_error: error.message,
                  attempts: supabase.raw('attempts + 1'),
                })
                .eq('id', pdfJob.id);
            } else if (data?.success) {
              console.log('✅ PDF enviado exitosamente:', data.pdf_id);
            }
          }

          console.log('✅ Procesamiento de PDFs completado');
        } else {
          console.log('✅ No hay facturas pendientes de envío de PDF');
        }
      } catch (error) {
        console.error('❌ Error en procesamiento automático de PDFs:', error);
      } finally {
        processingRef.current = false;
      }
    };

    processFunction();

    intervalRef.current = window.setInterval(() => {
      processFunction();
    }, 30000);

    console.log('👂 Iniciando escucha de cola de PDFs...');

    channelRef.current = supabase
      .channel('invoice-pdf-queue-listener')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invoice_pdf_queue',
          filter: 'status=eq.pending',
        },
        (payload) => {
          console.log('🔔 Nueva factura en cola de PDFs:', payload);
          setTimeout(() => processFunction(), 1000);
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado de suscripción de cola de PDFs:', status);
      });

    return () => {
      console.log('🛑 Cerrando suscripción de cola de PDFs...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
