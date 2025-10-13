import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { searchUsers } from '../../lib/userService';
import {
  Phone, PhoneCall, PhoneIncoming, PhoneOutgoing, Plus, Clock, User, MessageSquare,
  Ticket, Calendar, Edit2, Trash2, Eye, Volume2, Download, X, UserPlus, Building2, Mail, MapPin,
  RefreshCw, ChevronLeft, ChevronRight, Send, UserCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDialer } from '../../contexts/DialerContext';

interface Call {
  id: string;
  client_id: string | null;
  phone_number: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  status: string;
  notes: string;
  created_at: string;
  recording_url?: string;
  recording_sid?: string;
  twilio_call_sid?: string;
  clients?: { company_name: string; contact_name: string; phone: string; email: string };
}

interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
}

type ModalMode = 'create' | 'edit' | 'view';

export function CallsModule() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRetryListModal, setShowRetryListModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [callToDelete, setCallToDelete] = useState<Call | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const { user } = useAuth();
  const toast = useToast();
  const { openDialerWithNumber } = useDialer();

  const [formData, setFormData] = useState({
    client_id: '',
    phone_number: '',
    direction: 'outbound' as 'inbound' | 'outbound',
    duration: '',
    status: 'completed',
    notes: ''
  });

  const [newClientData, setNewClientData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: ''
  });

  const [ticketFormData, setTicketFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    category_id: '',
    assigned_to: ''
  });

  const [transferFormData, setTransferFormData] = useState({
    assigned_to: '',
    notes: ''
  });

  const [userSearchTerm, setUserSearchTerm] = useState('');

  useEffect(() => {
    loadCalls();
    loadClients();
    loadCategories();
    loadUsers();
  }, [currentPage]);

  // Suscribirse a cambios en tiempo real para actualizar la lista
  useEffect(() => {
    const channel = supabase
      .channel('calls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `caller_id=eq.${user?.id}`
        },
        (payload) => {
          // Recargar las llamadas cuando hay cambios
          loadCalls();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, currentPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(userSearchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchTerm]);

  const loadCalls = async () => {
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    // Filtrar solo las llamadas del usuario logueado
    const { data, count } = await supabase
      .from('calls')
      .select('*, clients(company_name, contact_name, phone, email)', { count: 'exact' })
      .eq('caller_id', user?.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (data) setCalls(data);
    if (count) setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));
  };

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('id, company_name, contact_name, phone, email');
    if (data) setClients(data);
  };

  const loadCategories = async () => {
    const { data } = await supabase.from('ticket_categories').select('*');
    if (data) setCategories(data);
  };

  const loadUsers = async (query: string = '') => {
    const users = await searchUsers(query, 50, 0);
    setUsers(users);
  };

  const openModal = (mode: ModalMode, call?: Call) => {
    setModalMode(mode);
    if (call) {
      setSelectedCall(call);
      setFormData({
        client_id: call.client_id || '',
        phone_number: call.phone_number || '',
        direction: call.direction,
        duration: call.duration.toString(),
        status: call.status,
        notes: call.notes || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const callData = {
        ...formData,
        duration: parseInt(formData.duration),
        caller_id: user?.id,
        client_id: formData.client_id || null
      };

      if (modalMode === 'edit' && selectedCall) {
        const { error } = await supabase
          .from('calls')
          .update(callData)
          .eq('id', selectedCall.id);

        if (error) throw error;
        toast.success('Llamada actualizada correctamente');
      } else {
        const { error } = await supabase.from('calls').insert(callData);
        if (error) throw error;
        toast.success('Llamada registrada correctamente');
      }

      loadCalls();
      resetForm();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!callToDelete) return;

    try {
      const { error } = await supabase
        .from('calls')
        .delete()
        .eq('id', callToDelete.id);

      if (error) throw error;

      toast.success('Llamada eliminada correctamente');
      loadCalls();
      setShowDeleteConfirm(false);
      setCallToDelete(null);
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
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
      setFormData({ ...formData, client_id: newClient.id, phone_number: newClient.phone });
      setNewClientData({ company_name: '', contact_name: '', email: '', phone: '', address: '' });
      setShowClientModal(false);
      loadClients();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      phone_number: '',
      direction: 'outbound',
      duration: '',
      status: 'completed',
      notes: ''
    });
    setShowModal(false);
    setSelectedCall(null);
  };

  const openCreateTicketModal = (call: Call) => {
    setSelectedCall(call);
    setTicketFormData({
      subject: `Seguimiento de llamada - ${call.clients?.company_name || call.clients?.contact_name || call.phone_number}`,
      description: `Llamada ${call.direction === 'inbound' ? 'entrante' : 'saliente'} con duración de ${formatDuration(call.duration)}.\n\nNotas de la llamada:\n${call.notes || 'Sin notas'}`,
      priority: 'medium',
      category_id: ''
    });
    setShowTicketModal(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCall) return;

    try {
      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 3).toUpperCase()}`;

      const { error } = await supabase.from('tickets').insert({
        ticket_number: ticketNumber,
        client_id: selectedCall.client_id,
        subject: ticketFormData.subject,
        description: ticketFormData.description,
        priority: ticketFormData.priority,
        category_id: ticketFormData.category_id || null,
        status: 'open',
        assigned_to: ticketFormData.assigned_to || user?.id,
        created_by: user?.id
      });

      if (error) throw error;

      toast.success('Ticket creado exitosamente desde la llamada');
      setShowTicketModal(false);
      setSelectedCall(null);
      setTicketFormData({ subject: '', description: '', priority: 'medium', category_id: '', assigned_to: '' });
    } catch (error: any) {
      toast.error(`Error al crear ticket: ${error.message}`);
    }
  };

  const handleTransferCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCall) return;

    try {
      const { error } = await supabase
        .from('calls')
        .update({
          caller_id: transferFormData.assigned_to,
          notes: selectedCall.notes
            ? `${selectedCall.notes}\n\n[Transferida] ${transferFormData.notes}`
            : `[Transferida] ${transferFormData.notes}`
        })
        .eq('id', selectedCall.id);

      if (error) throw error;

      toast.success('Llamada transferida exitosamente');
      setShowTransferModal(false);
      setSelectedCall(null);
      setTransferFormData({ assigned_to: '', notes: '' });
      setUserSearchTerm('');
      loadCalls();
    } catch (error: any) {
      toast.error(`Error al transferir llamada: ${error.message}`);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      completed: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Completada' },
      in_progress: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'En Progreso' },
      missed: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Perdida' },
      cancelled: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Cancelada' },
      failed: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Fallida' },
      busy: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Ocupado' },
      no_answer: { color: 'bg-slate-100 text-slate-800 border-slate-200', label: 'Sin Respuesta' },
      ringing: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Timbrando' },
      answered: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Contestada' }
    };

    const badge = badges[status] || { color: 'bg-slate-100 text-slate-800 border-slate-200', label: status };
    return (
      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const totalCalls = calls.length;
  const totalDuration = calls.reduce((sum, call) => sum + call.duration, 0);
  const avgDuration = totalCalls > 0 ? Math.floor(totalDuration / totalCalls) : 0;

  // Llamadas que necesitan reintento
  const failedCalls = calls.filter(call =>
    ['failed', 'busy', 'no_answer', 'missed'].includes(call.status)
  );

  const getFailedCallsForRetry = () => {
    return calls.filter(call =>
      ['failed', 'busy', 'no_answer', 'missed'].includes(call.status)
    );
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Llamadas
          </h1>
          <p className="text-slate-600 mt-2 text-lg">Registra y gestiona tus llamadas</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowRetryListModal(true)}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition shadow-lg ${
              failedCalls.length > 0
                ? 'bg-gradient-to-r from-orange-600 to-orange-500 text-white hover:from-orange-700 hover:to-orange-600'
                : 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-600 cursor-default'
            }`}
            disabled={failedCalls.length === 0}
          >
            <RefreshCw className="w-5 h-5" />
            <span>Reintentos ({failedCalls.length})</span>
          </button>
          <button
            onClick={() => openModal('create')}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-600 transition shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Registrar Llamada</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 hover:shadow-lg transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">Total Llamadas</span>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Phone className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-900">{totalCalls}</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 hover:shadow-lg transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">Tiempo Total</span>
            <div className="p-3 bg-green-50 rounded-lg">
              <PhoneCall className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-900">{formatDuration(totalDuration)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 hover:shadow-lg transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600">Duración Promedio</span>
            <div className="p-3 bg-orange-50 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-900">{formatDuration(avgDuration)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Cliente</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Dirección</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Duración</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Estado</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Notas</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Fecha</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    {call.clients ? (
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {call.clients.company_name || call.clients.contact_name}
                        </p>
                        {call.clients.company_name && call.clients.contact_name && (
                          <p className="text-xs text-slate-500">{call.clients.contact_name}</p>
                        )}
                        {call.phone_number && (
                          <p className="text-xs text-slate-400 font-mono">{call.phone_number}</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600 font-mono">{call.phone_number || 'Saliente'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {call.direction === 'inbound' ? (
                        <>
                          <PhoneIncoming className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-600 font-medium">Entrante</span>
                        </>
                      ) : (
                        <>
                          <PhoneOutgoing className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-blue-600 font-medium">Saliente</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-mono">
                    {formatDuration(call.duration)}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(call.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                    {call.notes || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(call.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openModal('view', call)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openModal('edit', call)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setCallToDelete(call);
                          setShowDeleteConfirm(true);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openCreateTicketModal(call)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-xs font-medium"
                        title="Crear ticket"
                      >
                        <Ticket className="w-3 h-3" />
                        Ticket
                      </button>
                      {['failed', 'busy', 'no_answer', 'missed'].includes(call.status) && (
                        <button
                          onClick={() => {
                            setSelectedCall(call);
                            setShowTransferModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition text-xs font-medium"
                          title="Transferir"
                        >
                          <Send className="w-3 h-3" />
                          Transferir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
            <div className="text-sm text-slate-600">
              Página {currentPage} de {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <PhoneCall className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {modalMode === 'view' ? 'Detalles de Llamada' :
                       modalMode === 'edit' ? 'Editar Llamada' : 'Registrar Llamada'}
                    </h2>
                    <p className="text-blue-100 text-sm mt-0.5">
                      {modalMode === 'view' ? 'Información completa de la llamada' : 'Complete los detalles de la llamada'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {modalMode === 'view' && selectedCall ? (
              <div className="p-8 space-y-6">
                {selectedCall.recording_url && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                    <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                      <Volume2 className="w-5 h-5" />
                      Grabación de la Llamada
                    </h3>
                    <audio controls className="w-full mb-3">
                      <source src={selectedCall.recording_url} type="audio/mpeg" />
                      Tu navegador no soporta el elemento de audio.
                    </audio>
                    <a
                      href={selectedCall.recording_url}
                      download
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Descargar Grabación
                    </a>
                  </div>
                )}

                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    Información del Cliente
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">{selectedCall.clients?.company_name ? 'Empresa' : 'Nombre'}</p>
                      <p className="text-sm text-slate-900 font-medium">
                        {selectedCall.clients?.company_name || selectedCall.clients?.contact_name || 'Sin asignar'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Contacto</p>
                      <p className="text-sm text-slate-900 font-medium">
                        {selectedCall.clients?.contact_name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Teléfono</p>
                      <p className="text-sm text-slate-900 font-mono">
                        {selectedCall.phone_number || selectedCall.clients?.phone || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Email</p>
                      <p className="text-sm text-slate-900">
                        {selectedCall.clients?.email || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <PhoneCall className="w-5 h-5 text-blue-600" />
                    Detalles de la Llamada
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Dirección</p>
                      <div className="flex items-center gap-2">
                        {selectedCall.direction === 'inbound' ? (
                          <>
                            <PhoneIncoming className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-600 font-medium">Entrante</span>
                          </>
                        ) : (
                          <>
                            <PhoneOutgoing className="w-4 h-4 text-blue-600" />
                            <span className="text-sm text-blue-600 font-medium">Saliente</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Duración</p>
                      <p className="text-sm text-slate-900 font-mono font-medium">
                        {formatDuration(selectedCall.duration)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Estado</p>
                      {getStatusBadge(selectedCall.status)}
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-xs font-medium text-slate-500 mb-1">Fecha y Hora</p>
                      <p className="text-sm text-slate-900">
                        {new Date(selectedCall.created_at).toLocaleString('es-ES', {
                          dateStyle: 'full',
                          timeStyle: 'long'
                        })}
                      </p>
                    </div>
                    {selectedCall.twilio_call_sid && (
                      <div className="md:col-span-3">
                        <p className="text-xs font-medium text-slate-500 mb-1">Twilio Call SID</p>
                        <p className="text-sm text-slate-600 font-mono">{selectedCall.twilio_call_sid}</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedCall.notes && (
                  <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-blue-600" />
                      Notas
                    </h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedCall.notes}</p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => openModal('edit', selectedCall)}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition font-medium shadow-lg"
                  >
                    <Edit2 className="w-4 h-4 inline mr-2" />
                    Editar Llamada
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      Información del Cliente
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowClientModal(true)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium"
                    >
                      <UserPlus className="w-4 h-4" />
                      Crear Cliente
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Cliente</label>
                      <select
                        value={formData.client_id}
                        onChange={(e) => {
                          const selectedClient = clients.find(c => c.id === e.target.value);
                          setFormData({
                            ...formData,
                            client_id: e.target.value,
                            phone_number: selectedClient?.phone || formData.phone_number
                          });
                        }}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        disabled={modalMode === 'view'}
                      >
                        <option value="">Sin cliente asignado</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.company_name || client.contact_name} {client.phone && `• ${client.phone}`}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Opcional: Asocia la llamada a un cliente existente</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Número de Teléfono *</label>
                      <input
                        type="tel"
                        value={formData.phone_number}
                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
                        placeholder="+59895148335"
                        required
                        disabled={modalMode === 'view'}
                      />
                      <p className="text-xs text-slate-500 mt-1">Formato E.164 recomendado (incluye +)</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-blue-600" />
                    Detalles de la Llamada
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-3">Dirección *</label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition ${
                          formData.direction === 'outbound'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-blue-300'
                        }`}>
                          <input
                            type="radio"
                            value="outbound"
                            checked={formData.direction === 'outbound'}
                            onChange={(e) => setFormData({ ...formData, direction: e.target.value as any })}
                            className="sr-only"
                            disabled={modalMode === 'view'}
                          />
                          <PhoneOutgoing className="w-6 h-6 mb-2" />
                          <span className="text-sm font-medium">Saliente</span>
                        </label>
                        <label className={`flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer transition ${
                          formData.direction === 'inbound'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-green-300'
                        }`}>
                          <input
                            type="radio"
                            value="inbound"
                            checked={formData.direction === 'inbound'}
                            onChange={(e) => setFormData({ ...formData, direction: e.target.value as any })}
                            className="sr-only"
                            disabled={modalMode === 'view'}
                          />
                          <PhoneIncoming className="w-6 h-6 mb-2" />
                          <span className="text-sm font-medium">Entrante</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Duración (segundos) *
                      </label>
                      <input
                        type="number"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="Ej: 120"
                        min="0"
                        required
                        disabled={modalMode === 'view'}
                      />
                      {formData.duration && (
                        <p className="text-xs text-slate-500 mt-1.5">
                          Equivale a: {formatDuration(parseInt(formData.duration))}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Estado de la Llamada</h3>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">Estado *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    required
                    disabled={modalMode === 'view'}
                  >
                    <option value="completed">Completada</option>
                    <option value="in_progress">En Progreso</option>
                    <option value="missed">Perdida</option>
                    <option value="cancelled">Cancelada</option>
                    <option value="failed">Fallida</option>
                    <option value="busy">Ocupado</option>
                    <option value="no_answer">Sin Respuesta</option>
                    <option value="ringing">Timbrando</option>
                    <option value="answered">Contestada</option>
                  </select>
                </div>

                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    Notas y Observaciones
                  </h3>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={5}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
                    placeholder="Resumen de la conversación, temas tratados, acuerdos alcanzados, próximos pasos..."
                    disabled={modalMode === 'view'}
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition font-medium shadow-lg shadow-blue-500/30"
                  >
                    {modalMode === 'edit' ? 'Actualizar Llamada' : 'Registrar Llamada'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Crear Nuevo Cliente</h2>
                    <p className="text-green-100 text-sm mt-0.5">Se asociará automáticamente a la llamada</p>
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
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
                    placeholder="Ej: Ayala IT (opcional para personas físicas)"
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
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
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
                    onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition font-mono"
                    placeholder="+59895148335"
                    required
                  />
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
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
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
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition"
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
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition font-medium shadow-lg shadow-green-500/30"
                >
                  Crear y Asociar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && callToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Eliminar Llamada</h3>
                <p className="text-sm text-slate-600 mt-1">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-900">
                ¿Estás seguro de que deseas eliminar esta llamada con{' '}
                <span className="font-semibold">
                  {callToDelete.clients?.company_name || callToDelete.clients?.contact_name || callToDelete.phone_number}
                </span>?
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setCallToDelete(null);
                }}
                className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition font-medium shadow-lg shadow-red-500/30"
              >
                Eliminar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {showTicketModal && selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <Ticket className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Crear Ticket desde Llamada</h2>
                    <p className="text-purple-100 text-sm mt-0.5">
                      {selectedCall.clients?.company_name || selectedCall.clients?.contact_name || selectedCall.phone_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTicketModal(false);
                    setSelectedCall(null);
                  }}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateTicket} className="p-8 space-y-6">
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-start gap-3">
                  <PhoneCall className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 mb-1">Información de la Llamada</h4>
                    <div className="text-sm text-blue-700 space-y-1">
                      <p>• Dirección: <span className="font-medium">{selectedCall.direction === 'inbound' ? 'Entrante' : 'Saliente'}</span></p>
                      <p>• Duración: <span className="font-medium">{formatDuration(selectedCall.duration)}</span></p>
                      <p>• Estado: <span className="font-medium capitalize">{selectedCall.status}</span></p>
                      <p>• Fecha: <span className="font-medium">{new Date(selectedCall.created_at).toLocaleString()}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Asunto del Ticket *</label>
                <input
                  type="text"
                  value={ticketFormData.subject}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, subject: e.target.value })}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                  placeholder="Ej: Problema con el producto X"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Descripción *</label>
                <textarea
                  value={ticketFormData.description}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, description: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition resize-none"
                  placeholder="Describe el problema o requerimiento..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Prioridad *</label>
                  <select
                    value={ticketFormData.priority}
                    onChange={(e) => setTicketFormData({ ...ticketFormData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Categoría</label>
                  <select
                    value={ticketFormData.category_id}
                    onChange={(e) => setTicketFormData({ ...ticketFormData, category_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Asignar a</label>
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="Buscar usuario por nombre..."
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition mb-3"
                  />
                  <div className="max-h-64 overflow-y-auto space-y-2 border-2 border-slate-200 rounded-xl p-3 bg-slate-50">
                    <div
                      onClick={() => setTicketFormData({ ...ticketFormData, assigned_to: '' })}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        ticketFormData.assigned_to === ''
                          ? 'bg-purple-100 border-purple-500 shadow-md'
                          : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          ticketFormData.assigned_to === ''
                            ? 'bg-purple-500'
                            : 'bg-slate-300'
                        }`}>
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold ${
                            ticketFormData.assigned_to === ''
                              ? 'text-purple-900'
                              : 'text-slate-800'
                          }`}>
                            A mí mismo
                          </p>
                        </div>
                        {ticketFormData.assigned_to === '' && (
                          <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                    {users.length === 0 ? (
                      <div className="text-center py-8">
                        <User className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">No se encontraron usuarios</p>
                      </div>
                    ) : (
                      users.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => setTicketFormData({ ...ticketFormData, assigned_to: u.id })}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            ticketFormData.assigned_to === u.id
                              ? 'bg-purple-100 border-purple-500 shadow-md'
                              : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              ticketFormData.assigned_to === u.id
                                ? 'bg-purple-500'
                                : 'bg-slate-300'
                            }`}>
                              <User className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold truncate ${
                                ticketFormData.assigned_to === u.id
                                  ? 'text-purple-900'
                                  : 'text-slate-800'
                              }`}>
                                {u.name}
                              </p>
                              <p className={`text-sm truncate ${
                                ticketFormData.assigned_to === u.id
                                  ? 'text-purple-700'
                                  : 'text-slate-500'
                              }`}>
                                {u.email}
                              </p>
                            </div>
                            {ticketFormData.assigned_to === u.id && (
                              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowTicketModal(false);
                    setSelectedCall(null);
                  }}
                  className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition font-medium shadow-lg shadow-purple-500/30"
                >
                  Crear Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRetryListModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-orange-600 to-orange-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Lista de Reintentos</h2>
                    <p className="text-orange-100 text-sm mt-0.5">
                      Llamadas fallidas, ocupadas o sin respuesta ({failedCalls.length})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRetryListModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8">
              {failedCalls.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 text-lg">No hay llamadas para reintentar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {failedCalls.map((call) => (
                    <div
                      key={call.id}
                      className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50 transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-orange-100 rounded-lg">
                              <Phone className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900">
                                {call.clients?.company_name || call.clients?.contact_name || 'Sin cliente'}
                              </h3>
                              <p className="text-sm text-slate-600 font-mono">{call.phone_number}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            <div>
                              <p className="text-xs text-slate-500">Estado</p>
                              {getStatusBadge(call.status)}
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Fecha</p>
                              <p className="text-sm text-slate-700">
                                {new Date(call.created_at).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Duración</p>
                              <p className="text-sm text-slate-700 font-mono">
                                {formatDuration(call.duration)}
                              </p>
                            </div>
                          </div>
                          {call.notes && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                              <p className="text-xs text-slate-500 mb-1">Notas</p>
                              <p className="text-sm text-slate-700">{call.notes}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => {
                              openDialerWithNumber(call.phone_number);
                              setShowRetryListModal(false);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium whitespace-nowrap"
                          >
                            <PhoneCall className="w-4 h-4" />
                            Llamar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCall(call);
                              setShowRetryListModal(false);
                              setShowTicketModal(true);
                              setTicketFormData({
                                subject: `Reintento de llamada - ${call.clients?.company_name || call.phone_number}`,
                                description: `Llamada ${call.status === 'failed' ? 'fallida' : call.status === 'busy' ? 'ocupada' : 'sin respuesta'} el ${new Date(call.created_at).toLocaleString()}.\n\nNotas: ${call.notes || 'Sin notas'}`,
                                priority: 'medium',
                                category_id: '',
                                assigned_to: ''
                              });
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium whitespace-nowrap"
                          >
                            <Ticket className="w-4 h-4" />
                            Crear Ticket
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCall(call);
                              setShowRetryListModal(false);
                              setShowTransferModal(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium whitespace-nowrap"
                          >
                            <Send className="w-4 h-4" />
                            Transferir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTransferModal && selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <Send className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Transferir Llamada</h2>
                    <p className="text-blue-100 text-sm mt-0.5">
                      {selectedCall.clients?.company_name || selectedCall.clients?.contact_name || selectedCall.phone_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedCall(null);
                    setTransferFormData({ assigned_to: '', notes: '' });
                    setUserSearchTerm('');
                  }}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleTransferCall} className="p-8 space-y-6">
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <div className="flex items-start gap-3">
                  <PhoneCall className="w-5 h-5 text-orange-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-orange-900 mb-1">Información de la Llamada</h4>
                    <div className="text-sm text-orange-700 space-y-1">
                      <p>• Estado: <span className="font-medium capitalize">{selectedCall.status}</span></p>
                      <p>• Teléfono: <span className="font-medium font-mono">{selectedCall.phone_number}</span></p>
                      <p>• Fecha: <span className="font-medium">{new Date(selectedCall.created_at).toLocaleString()}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Transferir a *
                </label>
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Buscar usuario por nombre..."
                  className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition mb-3"
                />
                <div className="max-h-64 overflow-y-auto space-y-2 border-2 border-slate-200 rounded-xl p-3 bg-slate-50">
                  {users.filter(u => u.id !== user?.id).length === 0 ? (
                    <div className="text-center py-8">
                      <User className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                      <p className="text-slate-500 text-sm">No se encontraron usuarios</p>
                    </div>
                  ) : (
                    users
                      .filter(u => u.id !== user?.id)
                      .map((u) => (
                        <div
                          key={u.id}
                          onClick={() => setTransferFormData({ ...transferFormData, assigned_to: u.id })}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            transferFormData.assigned_to === u.id
                              ? 'bg-blue-100 border-blue-500 shadow-md'
                              : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              transferFormData.assigned_to === u.id
                                ? 'bg-blue-500'
                                : 'bg-slate-300'
                            }`}>
                              <User className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold truncate ${
                                transferFormData.assigned_to === u.id
                                  ? 'text-blue-900'
                                  : 'text-slate-800'
                              }`}>
                                {u.name}
                              </p>
                              <p className={`text-sm truncate ${
                                transferFormData.assigned_to === u.id
                                  ? 'text-blue-700'
                                  : 'text-slate-500'
                              }`}>
                                {u.email}
                              </p>
                            </div>
                            {transferFormData.assigned_to === u.id && (
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Notas de Transferencia *</label>
                <textarea
                  value={transferFormData.notes}
                  onChange={(e) => setTransferFormData({ ...transferFormData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
                  placeholder="Motivo de la transferencia, contexto adicional..."
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false);
                    setSelectedCall(null);
                    setTransferFormData({ assigned_to: '', notes: '' });
                    setUserSearchTerm('');
                  }}
                  className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition font-medium shadow-lg shadow-blue-500/30"
                >
                  Transferir Llamada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
