import { useEffect, useState, useRef } from 'react';
import { Device } from '@twilio/voice-sdk';
import type { Call } from '@twilio/voice-sdk';
import { twilioService } from '../lib/twilioService';
import { useToast } from '../contexts/ToastContext';

export function useTwilioDevice() {
  const [device, setDevice] = useState<Device | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isReady, setIsReady] = useState(false);
  const toast = useToast();
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const toastRef = useRef(toast);
  const errorCountRef = useRef(0);
  const hasShownErrorRef = useRef(false);

  // Keep toast ref updated
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    let mounted = true;

    const setupDevice = async () => {
      try {
        const tokenData = await twilioService.getTwilioToken();

        if (!tokenData || !mounted) {
          return;
        }

        const newDevice = new Device(tokenData.token, {
          logLevel: 1,
          codecPreferences: ['opus', 'pcmu'],
        });

        newDevice.on('registered', () => {
          errorCountRef.current = 0;
          hasShownErrorRef.current = false;
          if (mounted) {
            setIsReady(true);
          }
        });

        newDevice.on('error', (error: any) => {
          errorCountRef.current++;

          // Solo mostrar error una vez para evitar spam
          if (!hasShownErrorRef.current) {
            hasShownErrorRef.current = true;

            if (error.message?.includes('JWT') || error.message?.includes('31204')) {
              toastRef.current?.error('Error de autenticación con Twilio. Verifica las credenciales API en Configuración.');
            } else {
              toastRef.current?.error('Error con el dispositivo de llamadas');
            }
          }

          // Si hay más de 3 errores, destruir el dispositivo para evitar loop
          if (errorCountRef.current >= 3 && deviceRef.current) {
            deviceRef.current.destroy();
            deviceRef.current = null;
            setDevice(null);
            setIsReady(false);
          }
        });

        newDevice.on('incoming', (call: Call) => {

          call.on('accept', () => {
            if (mounted) {
              setActiveCall(call);
              activeCallRef.current = call;
              toastRef.current?.success('Llamada conectada en el navegador');
            }
          });

          call.on('disconnect', () => {
            if (mounted) {
              setActiveCall(null);
              activeCallRef.current = null;
              toastRef.current?.info('Llamada finalizada');
            }
          });

          call.on('cancel', () => {
            if (mounted) {
              setActiveCall(null);
              activeCallRef.current = null;
              toastRef.current?.info('Llamada cancelada');
            }
          });

          call.on('reject', () => {
            if (mounted) {
              setActiveCall(null);
              activeCallRef.current = null;
            }
          });

          call.accept();
          if (mounted) {
            setActiveCall(call);
            activeCallRef.current = call;
          }
        });

        await newDevice.register();

        if (mounted) {
          setDevice(newDevice);
          deviceRef.current = newDevice;
        }
      } catch (error: any) {
        if (!hasShownErrorRef.current) {
          hasShownErrorRef.current = true;
          if (error.message?.includes('JWT') || error.message?.includes('31204')) {
            toastRef.current?.error('Error de autenticación con Twilio. Verifica las credenciales API.');
          } else {
            toastRef.current?.error('Error al configurar dispositivo de llamadas');
          }
        }
      }
    };

    setupDevice();

    return () => {
      mounted = false;
      if (deviceRef.current) {
        const currentDevice = deviceRef.current;

        // Solo destruir si no hay llamada activa
        if (!activeCallRef.current) {
          currentDevice.unregister().catch((e) => {
          });
          currentDevice.destroy();
        } else {
        }
      }
    };
  }, []); // Empty dependency array - only run once

  const makeCall = async (phoneNumber: string): Promise<Call | null> => {
    if (!device || !isReady) {
      toast.error('Dispositivo de llamadas no está listo');
      return null;
    }

    try {

      const call = await device.connect({
        params: {
          To: phoneNumber
        }
      });

      call.on('accept', () => {
        setActiveCall(call);
        activeCallRef.current = call;
        toastRef.current?.success('Llamada conectada');
      });

      call.on('disconnect', () => {
        setActiveCall(null);
        activeCallRef.current = null;
        toastRef.current?.info('Llamada desconectada');
      });

      call.on('cancel', () => {
        setActiveCall(null);
        activeCallRef.current = null;
        toastRef.current?.info('Llamada cancelada');
      });

      call.on('reject', () => {
        setActiveCall(null);
        activeCallRef.current = null;
        toastRef.current?.error('Llamada rechazada');
      });

      setActiveCall(call);
      activeCallRef.current = call;
      return call;
    } catch (error: any) {
      toastRef.current?.error('Error al realizar la llamada: ' + (error.message || 'Error desconocido'));
      return null;
    }
  };

  const hangup = () => {
    if (activeCall) {
      activeCall.disconnect();
      setActiveCall(null);
      activeCallRef.current = null;
    }
  };

  return {
    device,
    activeCall,
    isReady,
    hangup,
    makeCall
  };
}
