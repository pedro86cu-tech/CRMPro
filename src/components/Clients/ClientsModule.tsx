import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ensureCurrentUserInSystemUsers } from '../../lib/userSync';
import {
  Plus, Search, Edit2, Trash2, Mail, Phone, MapPin, TrendingUp,
  DollarSign, ShoppingCart, FileText, Activity, Users, Building2, X,
  Star, Globe, Calendar, User, Briefcase, Tag
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog } from '../Common/ConfirmDialog';

interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'prospect';
  address: string;
  city: string;
  country: string;
  created_at: string;
}

interface ClientStats {
  totalRevenue: number;
  totalOrders: number;
  totalInvoices: number;
  activeTickets: number;
}

export function ClientsModule() {
  const [clients, setClients] = useState<Client[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientStats, setClientStats] = useState<Record<string, ClientStats>>({});
  const [overallStats, setOverallStats] = useState({
    total: 0,
    active: 0,
    prospects: 0,
    inactive: 0,
    newThisMonth: 0
  });
  const { user } = useAuth();
  const toast = useToast();

  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    status: 'prospect' as const
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    clientId: string | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    clientId: null
  });

  useEffect(() => {
    const initialize = async () => {
      await ensureCurrentUserInSystemUsers();
      loadClients();
    };
    initialize();
  }, []);

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setClients(data);
      calculateOverallStats(data);
      await loadClientStats(data);
    }
  };

  const calculateOverallStats = (clientsData: Client[]) => {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    setOverallStats({
      total: clientsData.length,
      active: clientsData.filter(c => c.status === 'active').length,
      prospects: clientsData.filter(c => c.status === 'prospect').length,
      inactive: clientsData.filter(c => c.status === 'inactive').length,
      newThisMonth: clientsData.filter(c => new Date(c.created_at) >= firstDayThisMonth).length
    });
  };

  const loadClientStats = async (clientsData: Client[]) => {
    const stats: Record<string, ClientStats> = {};

    for (const client of clientsData.slice(0, 20)) {
      const [invoices, orders, tickets] = await Promise.all([
        supabase.from('invoices').select('amount').eq('client_id', client.id).eq('status', 'paid'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('client_id', client.id),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('client_id', client.id).in('status', ['open', 'in_progress'])
      ]);

      stats[client.id] = {
        totalRevenue: invoices.data?.reduce((sum, inv) => sum + Number(inv.amount), 0) || 0,
        totalOrders: orders.count || 0,
        totalInvoices: invoices.data?.length || 0,
        activeTickets: tickets.count || 0
      };
    }

    setClientStats(stats);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim() && !formData.contact_name.trim()) {
      newErrors.contact_name = 'Debe ingresar al menos el nombre del contacto o empresa';
    }

    if (!formData.contact_name.trim() && !formData.company_name.trim()) {
      newErrors.company_name = 'Debe ingresar al menos el nombre del contacto o empresa';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Teléfono inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update({ ...formData, updated_by: user?.id })
          .eq('id', editingClient.id);

        if (error) {
          toast.error(`Error al actualizar: ${error.message}`);
          return;
        }

        toast.success('Cliente actualizado correctamente');
        loadClients();
        resetForm();
      } else {
        const { error } = await supabase
          .from('clients')
          .insert({ ...formData, created_by: user?.id });

        if (error) {
          toast.error(`Error al crear: ${error.message}`);
          return;
        }

        toast.success('Cliente creado correctamente');
        loadClients();
        resetForm();
      }
    } catch (err) {
      toast.error('Error inesperado al guardar el cliente');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar cliente?',
      message: 'Este cliente se eliminará permanentemente junto con todos sus datos asociados.',
      clientId: id
    });
  };

  const confirmDelete = async () => {
    if (confirmDialog.clientId) {
      const { error } = await supabase.from('clients').delete().eq('id', confirmDialog.clientId);
      if (error) {
        toast.error('Error al eliminar el cliente');
      } else {
        toast.success('Cliente eliminado correctamente');
        loadClients();
      }
    }
    setConfirmDialog({ isOpen: false, title: '', message: '', clientId: null });
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      company_name: client.company_name,
      contact_name: client.contact_name,
      email: client.email,
      phone: client.phone || '',
      address: client.address || '',
      city: client.city || '',
      country: client.country || '',
      status: client.status
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      contact_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: '',
      status: 'prospect'
    });
    setEditingClient(null);
    setShowModal(false);
    setErrors({});
  };

  const filteredClients = clients.filter(client =>
    (client.company_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    client.contact_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'inactive': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'prospect': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '✓';
      case 'inactive': return '○';
      case 'prospect': return '★';
      default: return '○';
    }
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          Gestión de Clientes
        </h1>
        <p className="text-slate-600 text-lg">Administra tu cartera de clientes y sus métricas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-3 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-slate-600 text-sm font-medium mb-1">Total Clientes</p>
          <p className="text-3xl font-bold text-slate-900">{overallStats.total}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-emerald-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-slate-600 text-sm font-medium mb-1">Activos</p>
          <p className="text-3xl font-bold text-slate-900">{overallStats.active}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-3 rounded-xl">
              <Star className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-slate-600 text-sm font-medium mb-1">Prospectos</p>
          <p className="text-3xl font-bold text-slate-900">{overallStats.prospects}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-gradient-to-br from-slate-500 to-slate-600 p-3 rounded-xl">
              <Activity className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-slate-600 text-sm font-medium mb-1">Inactivos</p>
          <p className="text-3xl font-bold text-slate-900">{overallStats.inactive}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-orange-100 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-3 rounded-xl">
              <Calendar className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-slate-600 text-sm font-medium mb-1">Nuevos (mes)</p>
          <p className="text-3xl font-bold text-slate-900">{overallStats.newThisMonth}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por empresa, contacto o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Nuevo Cliente</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1"
          >
            <div className="h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>

            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${client.company_name ? 'from-blue-500 to-indigo-600' : 'from-emerald-500 to-teal-600'} rounded-xl flex items-center justify-center`}>
                    {client.company_name ? <Building2 className="w-6 h-6 text-white" /> : <User className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">
                      {client.company_name || client.contact_name}
                    </h3>
                    {client.company_name && (
                      <p className="text-sm text-slate-500 flex items-center mt-1">
                        <User className="w-3 h-3 mr-1" />
                        {client.contact_name}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(client.status)}`}>
                  {getStatusIcon(client.status)} {client.status === 'active' ? 'Activo' : client.status === 'prospect' ? 'Prospecto' : 'Inactivo'}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center text-sm text-slate-600">
                  <Mail className="w-4 h-4 mr-3 text-blue-500" />
                  <span className="truncate">{client.email}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center text-sm text-slate-600">
                    <Phone className="w-4 h-4 mr-3 text-emerald-500" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {(client.city || client.country) && (
                  <div className="flex items-center text-sm text-slate-600">
                    <MapPin className="w-4 h-4 mr-3 text-orange-500" />
                    <span>{[client.city, client.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>

              {clientStats[client.id] && (
                <div className="grid grid-cols-2 gap-3 mb-6 p-4 bg-slate-50 rounded-xl">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-xs text-slate-500 mb-1">Ingresos</p>
                    <p className="text-sm font-bold text-slate-900">
                      ${clientStats[client.id].totalRevenue.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-xs text-slate-500 mb-1">Órdenes</p>
                    <p className="text-sm font-bold text-slate-900">
                      {clientStats[client.id].totalOrders}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(client)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors border border-blue-200"
                >
                  <Edit2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Editar</span>
                </button>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors border border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                  </h2>
                  <p className="text-blue-100 text-sm mt-1">
                    {editingClient ? 'Actualiza la información del cliente' : 'Completa los datos del nuevo cliente'}
                  </p>
                </div>
                <button
                  onClick={resetForm}
                  className="text-white hover:bg-white/20 p-2 rounded-xl transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <User className="w-4 h-4 inline mr-2 text-emerald-600" />
                    Nombre del Contacto *
                  </label>
                  <input
                    type="text"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.contact_name ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                    placeholder="Ej: Juan Pérez"
                  />
                  {errors.contact_name && (
                    <p className="text-red-600 text-xs mt-1">{errors.contact_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Building2 className="w-4 h-4 inline mr-2 text-blue-600" />
                    Nombre de la Empresa
                    <span className="text-slate-400 text-xs ml-1">(Opcional para personas físicas)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.company_name ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                    placeholder="Ej: Acme Corporation (dejar vacío si es persona física)"
                  />
                  {errors.company_name && (
                    <p className="text-red-600 text-xs mt-1">{errors.company_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Tag className="w-4 h-4 inline mr-2 text-purple-600" />
                    Estado *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  >
                    <option value="prospect">Prospecto</option>
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-2 text-blue-600" />
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.email ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                    placeholder="contacto@empresa.com"
                  />
                  {errors.email && (
                    <p className="text-red-600 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-2 text-emerald-600" />
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full px-4 py-3 border ${errors.phone ? 'border-red-300' : 'border-slate-300'} rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition`}
                    placeholder="+1 234 567 8900"
                  />
                  {errors.phone && (
                    <p className="text-red-600 text-xs mt-1">{errors.phone}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2 text-orange-600" />
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Calle Principal 123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2 text-blue-600" />
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Nueva York"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    <Globe className="w-4 h-4 inline mr-2 text-indigo-600" />
                    País
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Estados Unidos"
                  />
                </div>
              </div>

              <div className="flex space-x-4 mt-8 pt-6 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl font-medium"
                >
                  {editingClient ? 'Actualizar Cliente' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="danger"
        confirmText="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', clientId: null })}
      />
    </div>
  );
}
