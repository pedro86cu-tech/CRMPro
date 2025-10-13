import { useState, useEffect, useRef } from 'react';
import { Phone, X, Search, User, Delete, PhoneCall, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { twilioService } from '../../lib/twilioService';
import { CallModal } from './CallModal';
import { useDialer } from '../../contexts/DialerContext';
import type { Call } from '@twilio/voice-sdk';

interface Contact {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
}

interface RecentCall {
  id: string;
  client_id: string | null;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
  clients?: {
    id: string;
    company_name: string;
    contact_name: string;
    phone: string;
  } | null;
}

interface PhoneDialerProps {
  makeCall: (phoneNumber: string) => Promise<Call | null>;
  isDeviceReady: boolean;
  activeCall: Call | null;
}

export function PhoneDialer({ makeCall, isDeviceReady, activeCall }: PhoneDialerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [activeTab, setActiveTab] = useState<'dial' | 'contacts' | 'recent'>('dial');
  const [isCalling, setIsCalling] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [twilioConfigured, setTwilioConfigured] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [activeCallSid, setActiveCallSid] = useState<string | undefined>();
  const [activeCallNumber, setActiveCallNumber] = useState('');
  const [activeCallContact, setActiveCallContact] = useState<Contact | null>(null);
  const dialerRef = useRef<HTMLDivElement>(null);
  const { registerDialer } = useDialer();

  useEffect(() => {
    registerDialer((number: string) => {
      setPhoneNumber(number);
      setIsOpen(true);
      setActiveTab('dial');
      setTimeout(() => {
        handleCall(number);
      }, 100);
    });
  }, [makeCall, isDeviceReady]);

  useEffect(() => {
    if (isOpen) {
      loadContacts();
      loadRecentCalls();
      checkTwilioConfig();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = contacts.filter(
        (contact) =>
          contact.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.phone?.includes(searchTerm)
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchTerm, contacts]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dialerRef.current && !dialerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    function handleKeyPress(event: KeyboardEvent) {
      if (!isOpen || activeTab !== 'dial') return;

      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const validKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#', '+'];

      if (validKeys.includes(event.key)) {
        event.preventDefault();
        setPhoneNumber((prev) => prev + event.key);
        playDTMFTone(event.key);
        setActiveKey(event.key);
        setTimeout(() => setActiveKey(null), 150);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        setPhoneNumber((prev) => prev.slice(0, -1));
      } else if (event.key === 'Enter' && phoneNumber) {
        event.preventDefault();
        handleCall(phoneNumber);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyPress);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isOpen, activeTab, phoneNumber]);

  const loadContacts = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, company_name, contact_name, phone, email')
      .not('phone', 'is', null)
      .order('company_name');
    if (data) {
      setContacts(data);
      setFilteredContacts(data);
    }
  };

  const loadRecentCalls = async () => {
    const { data } = await supabase
      .from('calls')
      .select('id, client_id, phone_number, direction, created_at, clients(company_name, contact_name, phone)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      const enrichedCalls = await Promise.all(
        data.map(async (call) => {
          if (!call.clients && call.phone_number) {
            const { data: matchingClient } = await supabase
              .from('clients')
              .select('id, company_name, contact_name, phone')
              .eq('phone', call.phone_number)
              .maybeSingle();

            if (matchingClient) {
              return {
                ...call,
                clients: matchingClient,
                client_id: matchingClient.id
              };
            }
          }
          return call;
        })
      );
      setRecentCalls(enrichedCalls);
    }
  };

  const checkTwilioConfig = async () => {
    const configured = await twilioService.loadConfig();
    setTwilioConfigured(configured);
  };

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const dtmfFrequencies: { [key: string]: [number, number] } = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
    '+': [941, 1336]
  };

  const playDTMFTone = (key: string) => {
    if (!dtmfFrequencies[key]) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const audioContext = audioContextRef.current;
    const [freq1, freq2] = dtmfFrequencies[key];

    const oscillator1 = audioContext.createOscillator();
    const oscillator2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator1.frequency.value = freq1;
    oscillator2.frequency.value = freq2;
    oscillator1.type = 'sine';
    oscillator2.type = 'sine';

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator1.start(audioContext.currentTime);
    oscillator2.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.15);
    oscillator2.stop(audioContext.currentTime + 0.15);
  };

  const handleNumberClick = (num: string) => {
    setPhoneNumber((prev) => prev + num);
    setCallError(null);

    playDTMFTone(num);

    setActiveKey(num);
    setTimeout(() => setActiveKey(null), 150);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = async (number: string, contact?: Contact) => {
    if (!twilioConfigured || !isDeviceReady) {
      window.open(`tel:${number}`, '_self');
      return;
    }

    setIsCalling(true);
    setCallError(null);

    try {

      const call = await makeCall(number);

      if (call) {

        setActiveCallSid(call.parameters.CallSid);
        setActiveCallNumber(number);
        setActiveCallContact(contact || null);

        setPhoneNumber('');
        setCallError(null);
        setIsCalling(false);

        setShowCallModal(true);
        setIsOpen(false);

        loadRecentCalls();
      } else {
        setCallError('Error al iniciar la llamada');
        setIsCalling(false);
      }
    } catch (error: any) {
      setCallError('Error inesperado al realizar la llamada');
      setIsCalling(false);
    }
  };

  const handleCloseCallModal = () => {
    setShowCallModal(false);
    setActiveCallSid(undefined);
    setActiveCallNumber('');
    setActiveCallContact(null);
    loadRecentCalls();
    loadContacts();
  };

  const dialPadNumbers = [
    { num: '1', letters: '' },
    { num: '2', letters: 'ABC' },
    { num: '3', letters: 'DEF' },
    { num: '4', letters: 'GHI' },
    { num: '5', letters: 'JKL' },
    { num: '6', letters: 'MNO' },
    { num: '7', letters: 'PQRS' },
    { num: '8', letters: 'TUV' },
    { num: '9', letters: 'WXYZ' },
    { num: '*', letters: '' },
    { num: '0', letters: '+' },
    { num: '#', letters: '' },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-40 group ${
          isOpen
            ? 'bg-red-500 hover:bg-red-600 rotate-0'
            : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 hover:scale-110'
        }`}
      >
        {isOpen ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <Phone className="w-7 h-7 text-white group-hover:animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div
          ref={dialerRef}
          className="fixed bottom-20 right-2 left-2 sm:bottom-24 sm:right-6 sm:left-auto w-auto sm:w-[400px] max-h-[calc(100vh-90px)] sm:max-h-[calc(100vh-120px)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in slide-in-from-bottom-5 duration-300 flex flex-col"
        >
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-5 py-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                  <PhoneCall className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Marcador</h3>
              </div>
              <div className="flex items-center gap-1">
                {twilioConfigured ? (
                  <>
                    <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-100 font-medium">Twilio Activo</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-yellow-300 rounded-full"></div>
                    <span className="text-xs text-green-100 font-medium">Tel: Básico</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2 bg-white bg-opacity-10 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('dial')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'dial'
                    ? 'bg-white text-green-700 shadow-md'
                    : 'text-white hover:bg-white hover:bg-opacity-20'
                }`}
              >
                Teclado
              </button>
              <button
                onClick={() => setActiveTab('contacts')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'contacts'
                    ? 'bg-white text-green-700 shadow-md'
                    : 'text-white hover:bg-white hover:bg-opacity-20'
                }`}
              >
                Contactos
              </button>
              <button
                onClick={() => setActiveTab('recent')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'recent'
                    ? 'bg-white text-green-700 shadow-md'
                    : 'text-white hover:bg-white hover:bg-opacity-20'
                }`}
              >
                Recientes
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'dial' && (
              <div className="p-4">
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Ingresa número"
                      className={`w-full px-4 py-4 text-center text-2xl font-bold border-2 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all ${
                        phoneNumber
                          ? 'bg-gradient-to-br from-green-50 to-blue-50 border-green-400 text-green-900'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    />
                    {phoneNumber && (
                      <button
                        onClick={handleBackspace}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all hover:scale-110 active:scale-95"
                      >
                        <Delete className="w-5 h-5 text-red-600" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-3 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-600">
                    <div className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">0-9 * #</kbd>
                      <span className="text-slate-500">Teclado</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-sm font-mono">Enter</kbd>
                      <span className="text-slate-500">Llamar</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {dialPadNumbers.map((item) => (
                    <button
                      key={item.num}
                      onClick={() => handleNumberClick(item.num)}
                      className={`h-16 rounded-xl flex flex-col items-center justify-center transition-all duration-150 ${
                        activeKey === item.num
                          ? 'bg-gradient-to-br from-green-500 to-green-600 border-2 border-green-600 scale-95 shadow-inner'
                          : 'bg-white hover:bg-gradient-to-br hover:from-green-50 hover:to-green-100 border-2 border-slate-200 hover:border-green-400 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <span className={`text-2xl font-bold transition-colors ${
                        activeKey === item.num ? 'text-white' : 'text-slate-800'
                      }`}>
                        {item.num}
                      </span>
                      {item.letters && (
                        <span className={`text-[9px] font-semibold tracking-wider mt-0.5 transition-colors ${
                          activeKey === item.num ? 'text-green-100' : 'text-slate-500'
                        }`}>
                          {item.letters}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {callError && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">Error al realizar la llamada</p>
                        <p className="text-xs text-red-600 mt-0.5">
                          {callError.includes('geo-permissions') ? (
                            <>
                              Permisos internacionales no habilitados.{' '}
                              <a
                                href="https://www.twilio.com/console/voice/calls/geo-permissions"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline font-medium hover:text-red-800"
                              >
                                Configúralos aquí →
                              </a>
                            </>
                          ) : callError.toLowerCase().includes('credenciales') || callError.toLowerCase().includes('authenticate') ? (
                            <>
                              {callError}{' '}
                              <button
                                onClick={() => {
                                  setIsOpen(false);
                                  window.location.hash = '#settings';
                                }}
                                className="underline font-medium hover:text-red-800"
                              >
                                Ir a Ajustes →
                              </button>
                            </>
                          ) : (
                            callError
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => phoneNumber && handleCall(phoneNumber)}
                  disabled={!phoneNumber || isCalling}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none active:scale-95 hover:scale-[1.02] text-lg"
                >
                  {isCalling ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span className="animate-pulse">Llamando...</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall className="w-6 h-6 animate-pulse" />
                      {twilioConfigured ? 'Llamar con Twilio' : 'Llamar'}
                    </>
                  )}
                </button>
              </div>
            )}

            {activeTab === 'contacts' && (
              <div className="p-4">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar contactos..."
                    className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <div className="text-center py-8">
                      <User className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No hay contactos disponibles</p>
                    </div>
                  ) : (
                    filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-green-50 border border-slate-200 hover:border-green-300 rounded-xl transition-all group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 truncate">
                              {contact.company_name || contact.contact_name}
                            </p>
                            {contact.company_name && contact.contact_name && (
                              <p className="text-xs text-slate-500 truncate">
                                {contact.contact_name}
                              </p>
                            )}
                            <p className="text-sm text-slate-600 font-mono">{contact.phone}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCall(contact.phone, contact)}
                          className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <PhoneCall className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'recent' && (
              <div className="p-4">
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {recentCalls.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No hay llamadas recientes</p>
                    </div>
                  ) : (
                    recentCalls.map((call) => (
                      <div
                        key={call.id}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-green-50 border border-slate-200 hover:border-green-300 rounded-xl transition-all group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="relative">
                            <div
                              className={`w-10 h-10 ${
                                call.direction === 'inbound'
                                  ? 'bg-gradient-to-br from-blue-400 to-blue-600'
                                  : 'bg-gradient-to-br from-green-400 to-green-600'
                              } rounded-full flex items-center justify-center flex-shrink-0`}
                            >
                              <Phone className="w-5 h-5 text-white" />
                            </div>
                            <div
                              className={`absolute -bottom-1 -right-1 w-4 h-4 ${
                                call.direction === 'inbound' ? 'bg-blue-500' : 'bg-green-500'
                              } rounded-full border-2 border-white`}
                            >
                              <span className="text-[8px] text-white flex items-center justify-center h-full">
                                {call.direction === 'inbound' ? '↓' : '↑'}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 truncate">
                              {call.clients?.company_name || call.clients?.contact_name || 'Desconocido'}
                            </p>
                            {call.clients?.company_name && call.clients?.contact_name && (
                              <p className="text-xs text-slate-500 truncate">
                                {call.clients.contact_name}
                              </p>
                            )}
                            <p className="text-xs text-slate-500">
                              {new Date(call.created_at).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                            <p className="text-sm text-slate-600 font-mono">
                              {call.clients?.phone || call.phone_number || 'Sin número'}
                            </p>
                          </div>
                        </div>
                        {(call.clients?.phone || call.phone_number) && (
                          <button
                            onClick={() => handleCall(call.clients?.phone || call.phone_number || '', call.clients || null)}
                            className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <PhoneCall className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CallModal
        isOpen={showCallModal}
        onClose={handleCloseCallModal}
        phoneNumber={activeCallNumber}
        callSid={activeCallSid}
        contactInfo={activeCallContact}
        twilioCall={activeCall}
      />
    </>
  );
}
