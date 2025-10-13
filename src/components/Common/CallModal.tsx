import { useState, useEffect, useRef } from 'react';
import { X, PhoneCall, Clock, User, FileText, Ticket, Save, Phone, PhoneOff, Mic, UserPlus, Building2, Mail, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { twilioService } from '../../lib/twilioService';
import type { Call } from '@twilio/voice-sdk';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string;
  callSid?: string;
  contactInfo?: {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
  } | null;
  isIncoming?: boolean;
  twilioCall?: Call | null;
  onCallSaved?: () => void;
}

export function CallModal({ isOpen, onClose, phoneNumber, callSid, contactInfo, isIncoming = false, twilioCall, onCallSaved }: CallModalProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [callStartTime] = useState<Date>(new Date());
  const [callDuration, setCallDuration] = useState(0);
  const [isCallActive, setIsCallActive] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [callNotes, setCallNotes] = useState('');
  const [callStatus, setCallStatus] = useState<'completed' | 'in_progress' | 'missed' | 'cancelled' | 'no_answer' | ''>('');
  const [createTicket, setCreateTicket] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isSaving, setIsSaving] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingSid, setRecordingSid] = useState<string | null>(null);
  const [isLoadingRecording, setIsLoadingRecording] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<number | null>(null);

  const [showClientModal, setShowClientModal] = useState(false);
  const [currentContactInfo, setCurrentContactInfo] = useState(contactInfo);
  const [newClientData, setNewClientData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: phoneNumber,
    address: ''
  });

  useEffect(() => {
    setNewClientData(prev => ({ ...prev, phone: phoneNumber }));
  }, [phoneNumber]);

  useEffect(() => {
    if (isOpen && isCallActive) {
      timerRef.current = setInterval(() => {
        const duration = Math.floor((new Date().getTime() - callStartTime.getTime()) / 1000);
        setCallDuration(duration);
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [isOpen, callStartTime, isCallActive]);

  useEffect(() => {
    if (isOpen && !callId) {
      createCallRecord();
    }
  }, [isOpen]);

  // Actualizar el call_sid cuando esté disponible
  useEffect(() => {
    if (callId && callSid) {
      console.log('Updating call record with callSid:', callSid);
      supabase
        .from('calls')
        .update({ call_sid: callSid })
        .eq('id', callId)
        .then(({ error }) => {
          if (error) {
            console.error('Error updating call_sid:', error);
          } else {
            console.log('call_sid updated successfully');
          }
        });
    }
  }, [callId, callSid]);

  // Escuchar eventos de disconnect desde el SDK de Twilio
  useEffect(() => {
    if (!twilioCall) return;

    const handleDisconnect = () => {
      setIsCallActive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      toast.info('Llamada finalizada.');

      // Esperar un poco antes de intentar cargar la grabación
      if (callSid) {
        setTimeout(() => {
          setIsLoadingRecording(true);
          loadRecording();
        }, 5000); // Esperar 5 segundos para que Twilio procese
      }
    };

    twilioCall.on('disconnect', handleDisconnect);

    return () => {
      twilioCall.removeListener('disconnect', handleDisconnect);
    };
  }, [twilioCall, toast, callSid]);

  useEffect(() => {
    if (!isOpen || !callSid) return;

    // Escuchar cambios en la tabla calls para detectar grabaciones y estado
    const callChannel = supabase
      .channel(`call-updates-${callSid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `call_sid=eq.${callSid}`
        },
        (payload) => {
          const call = payload.new as any;

          // Si hay URL de grabación, mostrarla
          if (call.recording_url && call.recording_sid) {
            setRecordingUrl(call.recording_url);
            setRecordingSid(call.recording_sid);
            setIsLoadingRecording(false);
            toast.success('Grabación disponible');
          }

          // Si el estado cambió a completado/finalizado, cerrar la llamada
          if (call.status === 'completed' || call.status === 'failed' || call.status === 'busy' || call.status === 'no-answer') {
            setIsCallActive(false);
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }
            if (call.duration) {
              setCallDuration(call.duration);
            }

            // Mostrar notificación
            toast.info('Llamada finalizada.');

            // Si no hay grabación, intentar cargarla
            if (!call.recording_url) {
              setIsLoadingRecording(true);

              // Esperar un poco más antes de intentar cargar
              setTimeout(() => {
                loadRecording();
              }, 5000); // Esperar 5 segundos antes de empezar a buscar
            }
          }
        }
      )
      .subscribe();

    if (isIncoming) {
      const incomingChannel = supabase
        .channel(`incoming-call-status-${callSid}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'incoming_calls',
            filter: `call_sid=eq.${callSid}`
          },
          (payload) => {
            const call = payload.new as any;

            if (call.recording_url && call.recording_sid) {
              setRecordingUrl(call.recording_url);
              setRecordingSid(call.recording_sid);
              toast.success('Grabación disponible');
            }

            if (call.status === 'ended' || call.status === 'missed' || call.status === 'completed') {
              setIsCallActive(false);
              if (timerRef.current) {
                clearInterval(timerRef.current);
              }
              toast.info('Llamada finalizada');
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(callChannel);
        supabase.removeChannel(incomingChannel);
      };
    }

    return () => {
      supabase.removeChannel(callChannel);
    };
  }, [isOpen, callSid, isIncoming]);

  const createCallRecord = async () => {
    try {
      console.log('Creating call record with callSid:', callSid);
      const { data, error } = await supabase
        .from('calls')
        .insert({
          client_id: currentContactInfo?.id || null,
          caller_id: user?.id,
          direction: isIncoming ? 'inbound' : 'outbound',
          phone_number: phoneNumber,
          status: 'in_progress',
          started_at: callStartTime.toISOString(),
          call_sid: callSid || null
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating call record:', error);
        throw error;
      }

      if (data) {
        console.log('Call record created successfully:', data);
        setCallId(data.id);
      }
    } catch (error) {
      console.error('Exception in createCallRecord:', error);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          ...newClientData,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Cliente creado exitosamente');

      setCurrentContactInfo({
        id: newClient.id,
        company_name: newClient.company_name,
        contact_name: newClient.contact_name,
        email: newClient.email
      });

      if (callId) {
        await supabase
          .from('calls')
          .update({ client_id: newClient.id })
          .eq('id', callId);
      }

      setNewClientData({ company_name: '', contact_name: '', email: '', phone: phoneNumber, address: '' });
      setShowClientModal(false);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    // Desconectar la llamada de Twilio si existe
    if (twilioCall) {
      try {
        twilioCall.disconnect();
        toast.success('Llamada finalizada');
      } catch (error) {
        console.error('Error disconnecting call:', error);
        toast.error('Error al colgar la llamada');
      }
    }

    setIsCallActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Esperar un poco antes de intentar cargar la grabación
    if (callSid) {
      setTimeout(() => {
        loadRecording();
      }, 2000);
    }
  };

  const loadRecording = async () => {
    if (!callSid) {
      setIsLoadingRecording(false);
      return;
    }

    // Limpiar timers previos
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }

    setIsLoadingRecording(true);

    // Función para verificar la grabación
    const checkRecording = async (): Promise<boolean> => {
      try {
        // Primero verificar en la base de datos
        const { data: callData } = await supabase
          .from('calls')
          .select('recording_url, recording_sid')
          .eq('call_sid', callSid)
          .maybeSingle();

        if (callData?.recording_url && callData?.recording_sid) {
          setRecordingUrl(callData.recording_url);
          setRecordingSid(callData.recording_sid);
          setIsLoadingRecording(false);
          toast.success('Grabación disponible');
          return true;
        }

        return false;
      } catch (error) {
        console.error('Error loading recording:', error);
        return false;
      }
    };

    // Intentar inmediatamente
    const foundImmediately = await checkRecording();

    if (foundImmediately) {
      return;
    }

    // Si no se encontró, esperar y reintentar
    let attempts = 0;
    const maxAttempts = 8; // 8 intentos (24 segundos)
    recordingIntervalRef.current = setInterval(async () => {
      attempts++;

      const found = await checkRecording();

      if (found) {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
        }
      } else if (attempts >= maxAttempts) {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        setIsLoadingRecording(false);
        // No mostrar el mensaje si ya hay una grabación
        if (!recordingUrl) {
          toast.info('La grabación aparecerá automáticamente cuando Twilio la procese.');
        }
      }
    }, 3000);

    // Asegurarse de limpiar el intervalo después de un tiempo máximo
    recordingTimeoutRef.current = setTimeout(() => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setIsLoadingRecording(false);
    }, 30000); // Timeout absoluto de 30 segundos
  };

  // Limpiar timers cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    };
  }, []);

  const handleSave = async () => {
    if (!callId) {
      toast.error('No se pudo guardar la llamada');
      return;
    }

    if (isCallActive) {
      handleEndCall();
    }

    setIsSaving(true);

    try {
      const { error: callError } = await supabase
        .from('calls')
        .update({
          duration: callDuration,
          notes: callNotes,
          status: callStatus || 'completed',
          ended_at: new Date().toISOString(),
          recording_url: recordingUrl,
          recording_sid: recordingSid,
          client_id: currentContactInfo?.id || null
        })
        .eq('id', callId);

      if (callError) throw callError;

      if (createTicket && ticketTitle) {
        const { error: ticketError } = await supabase
          .from('tickets')
          .insert({
            title: ticketTitle,
            description: ticketDescription || `Ticket generado desde llamada a ${phoneNumber}\n\nNotas de la llamada:\n${callNotes}`,
            priority: ticketPriority,
            status: 'open',
            client_id: currentContactInfo?.id || null,
            created_by: user?.id,
            assigned_to: user?.id
          });

        if (ticketError) throw ticketError;
      }

      toast.success('Llamada guardada exitosamente');
      if (onCallSaved) {
        onCallSaved();
      }
      onClose();
    } catch (error: any) {
      toast.error('Error al guardar la llamada');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-2 sm:p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="bg-white bg-opacity-20 p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                <PhoneCall className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-white truncate">
                  {isIncoming ? 'Llamada Entrante' : 'Llamada en Curso'}
                </h2>
                <p className="text-xs sm:text-sm text-green-100 truncate">{phoneNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {isCallActive && (
              <div className="mb-4 flex justify-center">
                <button
                  onClick={handleEndCall}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  <PhoneOff className="w-5 h-5" />
                  Colgar Llamada
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Duración</span>
                  {isCallActive && (
                    <div className="ml-auto flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-red-600 font-medium">En curso</span>
                    </div>
                  )}
                </div>
                <p className="text-3xl font-bold text-blue-700">{formatDuration(callDuration)}</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  {currentContactInfo ? <User className="w-5 h-5 text-green-600" /> : <Phone className="w-5 h-5 text-green-600" />}
                  <span className="text-sm font-medium text-green-900">
                    {currentContactInfo ? 'Cliente' : 'Número'}
                  </span>
                  {!currentContactInfo && (
                    <button
                      onClick={() => setShowClientModal(true)}
                      className="ml-auto p-1 bg-green-200 hover:bg-green-300 rounded-lg transition"
                      title="Crear cliente"
                    >
                      <UserPlus className="w-4 h-4 text-green-700" />
                    </button>
                  )}
                </div>
                <p className="text-lg font-bold text-green-700 truncate">
                  {currentContactInfo?.company_name || currentContactInfo?.contact_name || phoneNumber}
                </p>
                {currentContactInfo && currentContactInfo.company_name && currentContactInfo.contact_name && (
                  <p className="text-sm text-green-600 truncate">{currentContactInfo.contact_name}</p>
                )}
                {!currentContactInfo && (
                  <button
                    onClick={() => setShowClientModal(true)}
                    className="mt-2 text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    Crear Cliente
                  </button>
                )}
              </div>
            </div>

            {callSid && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4 border border-slate-200">
                <p className="text-xs text-slate-500">Call SID</p>
                <p className="text-sm font-mono text-slate-700 truncate">{callSid}</p>
              </div>
            )}

            {(recordingUrl || isLoadingRecording) && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 mb-4 border border-purple-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Mic className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-purple-900">Grabación de Llamada</h3>
                    {isLoadingRecording && (
                      <p className="text-xs text-purple-600">Cargando grabación...</p>
                    )}
                    {recordingUrl && (
                      <p className="text-xs text-purple-600">Grabación disponible</p>
                    )}
                  </div>
                </div>

                {recordingUrl && (
                  <div className="space-y-2">
                    <audio controls className="w-full" src={recordingUrl}>
                      Tu navegador no soporta el elemento de audio.
                    </audio>
                    <a
                      href={recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-700 hover:text-purple-900 underline"
                    >
                      Descargar grabación
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Estado de la Llamada
                </label>
                <select
                  value={callStatus}
                  onChange={(e) => setCallStatus(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Seleccionar...</option>
                  <option value="completed">Completada</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="missed">Perdida</option>
                  <option value="cancelled">Cancelada</option>
                  <option value="no_answer">Sin Respuesta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notas de la Llamada
                </label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  rows={4}
                  placeholder="Escribe notas sobre la llamada..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="border-t border-slate-200 pt-4">
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={createTicket}
                    onChange={(e) => setCreateTicket(e.target.checked)}
                    className="w-5 h-5 text-green-600 border-slate-300 rounded focus:ring-2 focus:ring-green-500"
                  />
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">
                      Crear ticket desde esta llamada
                    </span>
                  </div>
                </label>

                {createTicket && (
                  <div className="space-y-3 pl-8 animate-in slide-in-from-top-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Título del Ticket *
                      </label>
                      <input
                        type="text"
                        value={ticketTitle}
                        onChange={(e) => setTicketTitle(e.target.value)}
                        placeholder="Ej: Solicitud de soporte técnico"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Descripción (Opcional)
                      </label>
                      <textarea
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        rows={3}
                        placeholder="Descripción adicional del ticket..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Prioridad
                      </label>
                      <select
                        value={ticketPriority}
                        onChange={(e) => setTicketPriority(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || (createTicket && !ticketTitle)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-lg hover:from-green-700 hover:to-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Guardando...' : 'Finalizar y Guardar'}
            </button>
          </div>
        </div>
      </div>

      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Crear Nuevo Cliente</h2>
                    <p className="text-blue-100 text-sm mt-0.5">Durante la llamada con {phoneNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowClientModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateClient} className="p-8 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900">
                  <strong>Consejo:</strong> Puedes tomar los datos del cliente mientras hablas y registrarlos aquí.
                  Se asociarán automáticamente a esta llamada. Si es una persona física, deja el campo "Nombre de Empresa" vacío.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    Nombre de Empresa
                  </label>
                  <input
                    type="text"
                    value={newClientData.company_name}
                    onChange={(e) => setNewClientData({ ...newClientData, company_name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Ej: Ayala IT (opcional para personas físicas)"
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-1">Opcional si es persona física</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    Nombre de Contacto *
                  </label>
                  <input
                    type="text"
                    value={newClientData.contact_name}
                    onChange={(e) => setNewClientData({ ...newClientData, contact_name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    value={newClientData.phone}
                    className="w-full px-4 py-3 bg-slate-100 border-2 border-slate-300 rounded-xl font-mono text-slate-700 cursor-not-allowed"
                    placeholder="+59895148335"
                    required
                    disabled
                    readOnly
                  />
                  <p className="text-xs text-slate-500 mt-1">Número de la llamada en curso (no modificable)</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    Email *
                  </label>
                  <input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="contacto@empresa.com"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={newClientData.address}
                    onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="Calle, Ciudad, País"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowClientModal(false)}
                  className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition font-medium shadow-lg shadow-blue-500/30"
                >
                  Crear y Asociar a Llamada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
