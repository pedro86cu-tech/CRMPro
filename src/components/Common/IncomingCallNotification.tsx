import { useState, useEffect } from 'react';
import { Phone, PhoneOff, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { twilioService } from '../../lib/twilioService';

interface IncomingCall {
  id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  status: string;
  created_at: string;
}

interface IncomingCallNotificationProps {
  onAccept: (call: IncomingCall) => void;
}

export function IncomingCallNotification({ onAccept }: IncomingCallNotificationProps) {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isRinging, setIsRinging] = useState(false);
  const toast = useToast();
  const [audioElement] = useState<HTMLAudioElement | null>(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audio.loop = true;
      return audio;
    }
    return null;
  });

  useEffect(() => {
    const channel = supabase
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incoming_calls',
          filter: 'status=eq.ringing'
        },
        (payload) => {
          const call = payload.new as IncomingCall;
          setIncomingCall(call);
          setIsRinging(true);

          if (audioElement) {
            audioElement.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuFzvLaiTgIGGS679+PQAkTVbDm7qxZFgxOqOPxt2QdBj2V1+/QeSgEKH/M8dqNOwgXaLru46RTDwpJo+DwvGkeB';
          }

          toast.success('Llamada entrante');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'incoming_calls'
        },
        (payload) => {
          const call = payload.new as IncomingCall;

          if (call.status !== 'ringing' && incomingCall?.id === call.id) {
            setIncomingCall(null);
            setIsRinging(false);
            if (audioElement) {
              audioElement.pause();
              audioElement.currentTime = 0;
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      supabase.removeChannel(channel);
    };
  }, [incomingCall?.id]);

  const handleAccept = async () => {
    if (!incomingCall) return;

    try {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }

      setIsRinging(false);

      const result = await twilioService.connectIncomingCall(incomingCall.call_sid);

      if (!result.success) {
        toast.error(result.error || 'Error al conectar la llamada');
        setIsRinging(true);
        if (audioElement) {
        }
        return;
      }

      await supabase
        .from('incoming_calls')
        .update({ status: 'answered', answered_at: new Date().toISOString() })
        .eq('id', incomingCall.id);

      onAccept(incomingCall);
      setIncomingCall(null);
      toast.success('Llamada conectada');
    } catch (error) {
      toast.error('Error al aceptar la llamada');
    }
  };

  const handleReject = async () => {
    if (!incomingCall) return;

    try {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }

      setIsRinging(false);

      await supabase
        .from('incoming_calls')
        .update({ status: 'rejected', ended_at: new Date().toISOString() })
        .eq('id', incomingCall.id);

      setIncomingCall(null);
      toast.info('Llamada rechazada');
    } catch (error) {
      toast.error('Error al rechazar la llamada');
    }
  };

  if (!incomingCall || !isRinging) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] animate-in slide-in-from-top">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-green-500 p-6 max-w-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
            <div className="relative bg-green-500 p-4 rounded-full">
              <Phone className="w-8 h-8 text-white animate-bounce" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900">Llamada Entrante</h3>
            <div className="flex items-center gap-2 mt-1">
              <User className="w-4 h-4 text-slate-500" />
              <p className="text-slate-700 font-mono">{incomingCall.from_number}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleReject}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            <PhoneOff className="w-5 h-5" />
            Rechazar
          </button>
          <button
            onClick={handleAccept}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            <Phone className="w-5 h-5" />
            Contestar
          </button>
        </div>
      </div>
    </div>
  );
}
