import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus, MessageSquare, AlertCircle, Clock, CheckCircle, X, Search,
  Filter, Calendar, User, Tag, Paperclip, Activity, ChevronDown,
  AlertTriangle, HelpCircle, GitPullRequest, Bug, BookOpen, Building2,
  Send, MoreVertical, Edit, Trash2, Eye, Ticket
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';

interface Ticket {
  id: string;
  ticket_number: string;
  client_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  tags: string[] | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: { company_name: string; contact_name: string; email: string };
  ticket_categories?: { name: string; color: string; icon: string };
}

interface Comment {
  id: string;
  ticket_id: string;
  user_id: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

interface Activity {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
}

export function TicketsModule() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');
  const { user } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    ticket_number: '',
    client_id: '',
    subject: '',
    description: '',
    priority: 'medium' as const,
    category_id: '',
    assigned_to: '',
    due_date: '',
    tags: '',
    estimated_hours: ''
  });

  useEffect(() => {
    const initializeModule = async () => {
      await ensureCurrentUserInSystemUsers();
      loadTickets();
      loadClients();
      loadUsers();
      loadCategories();
    };
    initializeModule();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchTerm, filterStatus, filterPriority]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.user-dropdown-container')) {
          setShowUserDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

  const generateTicketNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `TKT-${timestamp}-${random}`;
  };

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        *,
        clients(company_name, contact_name, email),
        ticket_categories(name, color, icon)
      `)
      .or(`assigned_to.eq.${user?.id},created_by.eq.${user?.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      showToast('Error al cargar tickets', 'error');
      return;
    }
    if (data) setTickets(data);
  };

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, contact_name, company_name, email')
      .in('status', ['active', 'prospect'])
      .order('contact_name');
    if (data) setClients(data);
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('system_users')
      .select('id, email, full_name, role, is_active')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      return;
    }

    if (data) {
      const formattedUsers = data.map((u: any) => ({
        id: u.id,
        name: u.full_name,
        email: u.email,
        role: u.role
      }));
      setUsers(formattedUsers);
      setFilteredUsers(formattedUsers);
    }
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('ticket_categories')
      .select('*')
      .order('name');
    if (data) setCategories(data);
  };

  const loadComments = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) setComments(data);
  };

  const loadActivities = async (ticketId: string) => {
    const { data } = await supabase
      .from('ticket_activity')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });
    if (data) setActivities(data);
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.ticket_number.toLowerCase().includes(search) ||
        ticket.subject.toLowerCase().includes(search) ||
        ticket.description.toLowerCase().includes(search) ||
        ticket.clients?.company_name?.toLowerCase().includes(search) ||
        ticket.clients?.contact_name?.toLowerCase().includes(search)
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === filterStatus);
    }

    if (filterPriority !== 'all') {
      filtered = filtered.filter(ticket => ticket.priority === filterPriority);
    }

    setFilteredTickets(filtered);
  };

  const handleUserSearch = (searchValue: string) => {
    setUserSearchTerm(searchValue);
    if (!searchValue.trim()) {
      setFilteredUsers(users);
      setShowUserDropdown(false);
      return;
    }

    const search = searchValue.toLowerCase();
    const filtered = users.filter(user =>
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    );
    setFilteredUsers(filtered);
    setShowUserDropdown(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const ticketData: any = {
      ticket_number: generateTicketNumber(),
      client_id: formData.client_id,
      subject: formData.subject,
      description: formData.description,
      priority: formData.priority,
      category_id: formData.category_id || null,
      assigned_to: formData.assigned_to || user?.id,
      due_date: formData.due_date || null,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : null,
      created_by: user?.id,
      status: 'open'
    };

    const { error } = await supabase.from('tickets').insert(ticketData);

    if (error) {
      showToast('Error al crear ticket', 'error');
      return;
    }

    showToast('Ticket creado exitosamente', 'success');
    loadTickets();
    resetForm();
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !newComment.trim()) return;

    await ensureCurrentUserInSystemUsers();

    const { error } = await supabase.from('ticket_comments').insert({
      ticket_id: selectedTicket.id,
      user_id: user?.id,
      user_name: user?.name,
      user_email: user?.email,
      comment: newComment,
      is_internal: isInternalComment
    });

    if (error) {
      showToast('Error al agregar comentario', 'error');
      return;
    }

    showToast('Comentario agregado', 'success');
    setNewComment('');
    setIsInternalComment(false);
    loadComments(selectedTicket.id);
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
    const updateData: any = { status: newStatus, updated_by: user?.id };
    if (newStatus === 'resolved' || newStatus === 'closed') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase.from('tickets').update(updateData).eq('id', ticketId);

    if (error) {
      showToast('Error al actualizar estado', 'error');
      return;
    }

    showToast(`Ticket ${newStatus === 'closed' ? 'cerrado' : 'actualizado'}`, 'success');
    loadTickets();
    if (selectedTicket?.id === ticketId) {
      const updated = tickets.find(t => t.id === ticketId);
      if (updated) setSelectedTicket({ ...updated, status: newStatus as any });
      loadActivities(ticketId);
    }
  };

  const handleAssignUser = async (ticketId: string, userId: string) => {
    const { error } = await supabase
      .from('tickets')
      .update({ assigned_to: userId || null, updated_by: user?.id })
      .eq('id', ticketId);

    if (error) {
      showToast('Error al asignar usuario', 'error');
      return;
    }

    showToast('Usuario asignado correctamente', 'success');
    loadTickets();
    if (selectedTicket?.id === ticketId) {
      loadActivities(ticketId);
    }
  };

  const resetForm = () => {
    setFormData({
      ticket_number: '',
      client_id: '',
      subject: '',
      description: '',
      priority: 'medium',
      category_id: '',
      assigned_to: '',
      due_date: '',
      tags: '',
      estimated_hours: ''
    });
    setUserSearchTerm('');
    setShowUserDropdown(false);
    setShowModal(false);
  };

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    loadComments(ticket.id);
    loadActivities(ticket.id);
    setShowDetailModal(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800 border-red-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'waiting': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-300';
      case 'closed': return 'bg-slate-100 text-slate-800 border-slate-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
      case 'waiting': return <AlertTriangle className="w-4 h-4" />;
      case 'resolved': return <CheckCircle className="w-4 h-4" />;
      case 'closed': return <CheckCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getCategoryIcon = (iconName: string | undefined) => {
    const icons: any = {
      'AlertCircle': AlertCircle,
      'HelpCircle': HelpCircle,
      'GitPullRequest': GitPullRequest,
      'Bug': Bug,
      'BookOpen': BookOpen,
      'AlertTriangle': AlertTriangle
    };
    const Icon = icons[iconName || 'AlertCircle'];
    return Icon ? <Icon className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />;
  };

  const ticketsByStatus = {
    open: filteredTickets.filter(t => t.status === 'open'),
    in_progress: filteredTickets.filter(t => t.status === 'in_progress'),
    waiting: filteredTickets.filter(t => t.status === 'waiting'),
    resolved: filteredTickets.filter(t => t.status === 'resolved'),
    closed: filteredTickets.filter(t => t.status === 'closed')
  };

  const stats = [
    { label: 'Abiertos', value: ticketsByStatus.open.length, color: 'bg-red-500', icon: AlertCircle },
    { label: 'En Progreso', value: ticketsByStatus.in_progress.length, color: 'bg-blue-500', icon: Clock },
    { label: 'En Espera', value: ticketsByStatus.waiting.length, color: 'bg-yellow-500', icon: AlertTriangle },
    { label: 'Resueltos', value: ticketsByStatus.resolved.length, color: 'bg-green-500', icon: CheckCircle }
  ];

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Tickets de Soporte</h1>
          <p className="text-slate-600 mt-2">Gestiona y resuelve tickets de clientes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold">Nuevo Ticket</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <div className={`${stat.color} p-3 rounded-xl`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-bold text-slate-900">{stat.value}</span>
            </div>
            <p className="text-sm font-medium text-slate-600">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar tickets por número, asunto, cliente..."
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todos los estados</option>
                <option value="open">Abierto</option>
                <option value="in_progress">En Progreso</option>
                <option value="waiting">En Espera</option>
                <option value="resolved">Resuelto</option>
                <option value="closed">Cerrado</option>
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Todas las prioridades</option>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg text-slate-500">No se encontraron tickets</p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => handleTicketClick(ticket)}
                className="p-6 cursor-pointer hover:bg-slate-50 transition group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-xl ${ticket.ticket_categories ? 'bg-opacity-10' : 'bg-slate-100'}`}
                         style={{ backgroundColor: ticket.ticket_categories?.color + '20' }}>
                      {ticket.ticket_categories ? getCategoryIcon(ticket.ticket_categories.icon) : <AlertCircle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                          {ticket.ticket_number}
                        </span>
                        {ticket.ticket_categories && (
                          <span className="text-xs px-2 py-1 rounded-full" style={{
                            backgroundColor: ticket.ticket_categories.color + '20',
                            color: ticket.ticket_categories.color
                          }}>
                            {ticket.ticket_categories.name}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition">
                        {ticket.subject}
                      </h3>
                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{ticket.description}</p>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          <span>{ticket.clients?.company_name || ticket.clients?.contact_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                        {ticket.due_date && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Vence: {new Date(ticket.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${getStatusColor(ticket.status)} flex items-center gap-1`}>
                      {getStatusIcon(ticket.status)}
                      {ticket.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority.toUpperCase()}
                    </span>
                  </div>
                </div>
                {ticket.tags && ticket.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="w-3 h-3 text-slate-400" />
                    {ticket.tags.map((tag, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Ticket className="w-7 h-7" />
                    Nuevo Ticket de Soporte
                  </h2>
                  <p className="text-slate-300 mt-1 text-sm">Complete toda la información necesaria para registrar el ticket</p>
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto flex-1 bg-slate-50">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Información del Cliente
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Cliente *
                  </label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    required
                  >
                    <option value="">Seleccionar cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.company_name || client.contact_name} - {client.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  Detalles del Problema
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Asunto *
                    </label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      placeholder="Resumen breve del problema"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Descripción Detallada *
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={5}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      placeholder="Describe el problema en detalle...&#10;&#10;• ¿Qué estaba haciendo?&#10;• ¿Qué esperaba que pasara?&#10;• ¿Qué pasó en realidad?"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  Clasificación y Prioridad
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Categoría
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Prioridad *
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    >
                      <option value="low">🟢 Baja - Puede esperar</option>
                      <option value="medium">🟡 Media - Normal</option>
                      <option value="high">🟠 Alta - Importante</option>
                      <option value="urgent">🔴 Urgente - Crítico</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Asignación y Planificación
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative md:col-span-2 user-dropdown-container">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Asignar a <span className="text-slate-500 font-normal">(se auto-asigna si se deja vacío)</span>
                    </label>
                    <input
                      type="text"
                      value={userSearchTerm}
                      onChange={(e) => handleUserSearch(e.target.value)}
                      onFocus={() => setShowUserDropdown(true)}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      placeholder="Buscar usuario por nombre o email..."
                    />
                    {showUserDropdown && filteredUsers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border-2 border-slate-300 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {filteredUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, assigned_to: u.id });
                              setUserSearchTerm(u.name);
                              setShowUserDropdown(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-blue-50 transition border-b border-slate-100 last:border-0"
                          >
                            <div className="font-medium text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-500">{u.email} • {u.role}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Horas Estimadas
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.estimated_hours}
                      onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                      className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      placeholder="0.0"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Fecha de Vencimiento
                  </label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-blue-600" />
                  Etiquetas y Metadata
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Etiquetas <span className="text-slate-500 font-normal">(separadas por coma)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="bug, frontend, urgente, crítico"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Las etiquetas ayudan a categorizar y buscar tickets más fácilmente
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-slate-50 pb-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-8 py-3 border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-white hover:border-slate-400 transition font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition font-semibold shadow-lg flex items-center gap-2"
                >
                  <Ticket className="w-5 h-5" />
                  Crear Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-6 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-lg">
                      {selectedTicket.ticket_number}
                    </span>
                    {selectedTicket.ticket_categories && (
                      <span className="text-xs px-3 py-1 rounded-lg bg-white/20">
                        {selectedTicket.ticket_categories.name}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold mb-2">{selectedTicket.subject}</h2>
                  <div className="flex items-center gap-4 text-sm text-white/80">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      <span>{selectedTicket.clients?.company_name || selectedTicket.clients?.contact_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(selectedTicket.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Estado</p>
                    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border ${getStatusColor(selectedTicket.status)}`}>
                      {getStatusIcon(selectedTicket.status)}
                      {selectedTicket.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Prioridad</p>
                    <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-semibold border ${getPriorityColor(selectedTicket.priority)}`}>
                      {selectedTicket.priority.toUpperCase()}
                    </span>
                  </div>
                  {selectedTicket.due_date && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Vencimiento</p>
                      <p className="text-sm font-medium text-slate-900">
                        {new Date(selectedTicket.due_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {selectedTicket.estimated_hours && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Horas Estimadas</p>
                      <p className="text-sm font-medium text-slate-900">{selectedTicket.estimated_hours}h</p>
                    </div>
                  )}
                </div>
                <div className="relative user-dropdown-container">
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Asignar a Usuario
                    </div>
                  </label>
                  <div className="relative user-dropdown-container">
                    <input
                      type="text"
                      value={userSearchTerm || users.find(u => u.id === selectedTicket.assigned_to)?.name || ''}
                      onChange={(e) => {
                        handleUserSearch(e.target.value);
                      }}
                      onFocus={() => {
                        if (!userSearchTerm) {
                          setFilteredUsers(users);
                        }
                        setShowUserDropdown(true);
                      }}
                      placeholder="Buscar usuario..."
                      className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    {showUserDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        <div
                          onClick={() => {
                            handleAssignUser(selectedTicket.id, '');
                            setUserSearchTerm('');
                            setShowUserDropdown(false);
                            setFilteredUsers(users);
                          }}
                          className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100"
                        >
                          <span className="text-sm text-slate-500 italic">Sin asignar</span>
                        </div>
                        {filteredUsers.map((u) => (
                          <div
                            key={u.id}
                            onClick={() => {
                              handleAssignUser(selectedTicket.id, u.id);
                              setUserSearchTerm(u.name);
                              setShowUserDropdown(false);
                            }}
                            className="px-3 py-2 hover:bg-blue-50 cursor-pointer"
                          >
                            <div className="text-sm font-medium text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </div>
                        ))}
                        {filteredUsers.length === 0 && (
                          <div className="px-3 py-4 text-center text-sm text-slate-500">
                            No se encontraron usuarios
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Descripción</h3>
                <p className="text-slate-600 whitespace-pre-wrap">{selectedTicket.description}</p>
                {selectedTicket.tags && selectedTicket.tags.length > 0 && (
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Tag className="w-4 h-4 text-slate-400" />
                    {selectedTicket.tags.map((tag, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Acciones Rápidas</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'in_progress')}
                    className="px-4 py-2 bg-blue-100 text-blue-700 text-sm rounded-lg hover:bg-blue-200 transition font-medium"
                  >
                    En Progreso
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'waiting')}
                    className="px-4 py-2 bg-yellow-100 text-yellow-700 text-sm rounded-lg hover:bg-yellow-200 transition font-medium"
                  >
                    En Espera
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')}
                    className="px-4 py-2 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200 transition font-medium"
                  >
                    Resolver
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')}
                    className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="flex gap-4 border-b border-slate-200 mb-6">
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`pb-3 px-2 text-sm font-semibold transition border-b-2 ${
                      activeTab === 'comments'
                        ? 'text-blue-600 border-blue-600'
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Comentarios ({comments.length})
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('activity')}
                    className={`pb-3 px-2 text-sm font-semibold transition border-b-2 ${
                      activeTab === 'activity'
                        ? 'text-blue-600 border-blue-600'
                        : 'text-slate-500 border-transparent hover:text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Actividad ({activities.length})
                    </div>
                  </button>
                </div>

                {activeTab === 'comments' ? (
                  <>
                    <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                      {comments.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">No hay comentarios aún</p>
                      ) : (
                        comments.map((comment) => (
                          <div key={comment.id} className={`rounded-xl p-4 ${comment.is_internal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold text-slate-900">
                                    {comment.user_name || 'Usuario Desconocido'}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {comment.user_email || 'Sin email'}
                                  </span>
                                </div>
                                {comment.is_internal && (
                                  <span className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full">
                                    Interno
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500">
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.comment}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <div className="mb-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={isInternalComment}
                            onChange={(e) => setIsInternalComment(e.target.checked)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          Comentario interno (no visible para el cliente)
                        </label>
                      </div>
                      <div className="flex gap-3">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Escribe un comentario..."
                          rows={3}
                          className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              handleAddComment();
                            }
                          }}
                        />
                        <button
                          onClick={handleAddComment}
                          className="px-6 h-fit bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition flex items-center gap-2 font-medium shadow-lg"
                        >
                          <Send className="w-4 h-4" />
                          Enviar
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">Tip: Presiona Ctrl+Enter para enviar</p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {activities.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No hay actividad registrada</p>
                    ) : (
                      activities.map((activity) => (
                        <div key={activity.id} className="flex gap-3 pb-3 border-b border-slate-100 last:border-0">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Activity className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-slate-900">
                              <span className="font-semibold">{activity.action}</span>
                              {activity.field_changed && (
                                <>
                                  {' - '}
                                  <span className="text-slate-600">
                                    {activity.field_changed}: {activity.old_value} → {activity.new_value}
                                  </span>
                                </>
                              )}
                            </p>
                            {activity.description && (
                              <p className="text-sm text-slate-600 mt-1">{activity.description}</p>
                            )}
                            <span className="text-xs text-slate-500 mt-1 block">
                              {new Date(activity.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
